import { spawn, execFile, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { ForwarderState } from "../types/enums.js";

const execFileAsync = promisify(execFile);

export { ForwarderState };
export type ForwarderStatus = ForwarderState;

export interface ForwarderOptions {
  repo: string;
  url: string;
  events?: string[];
  secret?: string;
  onLog?: (line: string) => void;
  onError?: (err: Error) => void;
  onStatusChange?: (status: ForwarderState) => void;
  spawnFn?: typeof spawn;
  cleanupStaleHooks?: (repo: string) => Promise<boolean>;
  minRetryDelayMs?: number;
  maxRetryDelayMs?: number;
}

interface RawGitHubHook {
  id?: number;
  name?: string;
  config?: { url?: string };
}

export const isStaleCliHook = (hook: RawGitHubHook): boolean =>
  hook.name === "cli" &&
  hook.config?.url === "https://webhook-forwarder.github.com/hook" &&
  typeof hook.id === "number";

async function deleteSingleHook(repo: string, id: number): Promise<boolean> {
  try {
    await execFileAsync("gh", [
      "api",
      "-X",
      "DELETE",
      `repos/${repo}/hooks/${id}`,
    ]);
    return true;
  } catch {
    return false;
  }
}

export async function cleanupStaleWebhook(repo: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("gh", [
      "api",
      `repos/${repo}/hooks`,
    ]);
    const hooks: unknown = JSON.parse(stdout);
    if (!Array.isArray(hooks)) return false;

    const staleHooks = hooks.filter(isStaleCliHook);
    if (staleHooks.length === 0) return false;

    await Promise.all(staleHooks.map((h) => deleteSingleHook(repo, h.id!)));
    return true;
  } catch {
    return false;
  }
}

export class GhForwarder {
  private child: ChildProcess | null = null;
  private readonly options: ForwarderOptions;
  private isStopping = false;
  private status: ForwarderState = ForwarderState.Idle;
  private retryCount = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private uptimeTimer: NodeJS.Timeout | null = null;
  private lastStderr = "";

  constructor(options: ForwarderOptions) {
    this.options = options;
  }

  getStatus(): ForwarderState {
    return this.status;
  }

  getState(): ForwarderState {
    return this.status;
  }

  isRunning(): boolean {
    return (
      this.status === ForwarderState.Running &&
      this.child !== null &&
      !this.child.killed
    );
  }

  getRetryCount(): number {
    return this.retryCount;
  }

  start(): void {
    if (this.child) return;
    this.isStopping = false;

    this.clearTimers();
    this.lastStderr = "";

    const args = this.buildSpawnArgs();

    try {
      const spawnFn = this.options.spawnFn ?? spawn;
      this.child = spawnFn("gh", args, { stdio: ["ignore", "pipe", "pipe"] });

      this.setStatus(ForwarderState.Running);
      this.armUptimeResetTimer();
      this.bindChildEvents();
    } catch (err) {
      if (this.options.onError && err instanceof Error) {
        this.options.onError(err);
      }
      if (!this.isStopping) {
        this.handleUnexpectedExit().catch(() => {});
      }
    }
  }

  private buildSpawnArgs(): string[] {
    const eventsArg =
      this.options.events && this.options.events.length > 0
        ? this.options.events.join(",")
        : "*";

    const args = [
      "webhook",
      "forward",
      `--repo=${this.options.repo}`,
      `--url=${this.options.url}`,
      `--events=${eventsArg}`,
    ];

    if (this.options.secret) {
      args.push(`--secret=${this.options.secret}`);
    }

    return args;
  }

  private armUptimeResetTimer(): void {
    this.uptimeTimer = setTimeout(() => {
      this.retryCount = 0;
    }, 10000);
    this.uptimeTimer.unref();
  }

  private bindChildEvents(): void {
    if (!this.child) return;

    this.child.stdout?.on("data", (data: Buffer) => {
      const text = data.toString("utf8").trim();
      if (!text) return;
      this.retryCount = 0;
      this.options.onLog?.(text);
    });

    this.child.stderr?.on("data", (data: Buffer) => {
      const text = data.toString("utf8").trim();
      if (!text) return;
      this.lastStderr = this.lastStderr ? `${this.lastStderr}\n${text}` : text;
      if (this.isStopping) return;
      this.options.onLog?.(text);
    });

    this.child.on("error", (err) => {
      if (this.isStopping) return;
      this.options.onError?.(err);
    });

    this.child.on("exit", async () => {
      this.child = null;
      if (this.uptimeTimer) {
        clearTimeout(this.uptimeTimer);
        this.uptimeTimer = null;
      }
      if (this.isStopping) {
        this.setStatus(ForwarderState.Stopped);
        return;
      }

      await this.handleUnexpectedExit();
    });
  }

  private async healStaleHookIfConflicted(): Promise<void> {
    if (!this.lastStderr.includes("Hook already exists on this repository")) {
      return;
    }
    const cleanup = this.options.cleanupStaleHooks ?? cleanupStaleWebhook;
    try {
      await cleanup(this.options.repo);
    } catch {
      // ignore cleanup errors
    }
  }

  private calculateBackoffDelay(): number {
    const minDelay = this.options.minRetryDelayMs ?? 2000;
    const maxDelay = this.options.maxRetryDelayMs ?? 30000;
    return Math.min(minDelay * Math.pow(2, this.retryCount - 1), maxDelay);
  }

  private async handleUnexpectedExit(): Promise<void> {
    if (this.isStopping) return;

    this.retryCount++;
    const delay = this.calculateBackoffDelay();

    this.setStatus(ForwarderState.Reconnecting);

    await this.healStaleHookIfConflicted();

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isStopping) {
        this.start();
      }
    }, delay);
    this.reconnectTimer.unref();
  }

  private clearTimers(): void {
    if (this.uptimeTimer) {
      clearTimeout(this.uptimeTimer);
      this.uptimeTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  stop(): void {
    this.isStopping = true;
    this.clearTimers();

    if (this.child) {
      try {
        this.child.kill("SIGTERM");
      } catch {
        // Child process may already be dead
      }
      this.child = null;
    }

    this.retryCount = 0;
    this.setStatus(ForwarderState.Stopped);
  }

  private setStatus(status: ForwarderState): void {
    if (this.status === status) return;
    this.status = status;
    this.options.onStatusChange?.(status);
  }
}
