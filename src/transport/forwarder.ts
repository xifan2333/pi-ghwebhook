import { spawn, type ChildProcess } from "node:child_process";

export interface ForwarderOptions {
  repo: string;
  url: string;
  events?: string[];
  secret?: string;
  onLog?: (line: string) => void;
  onError?: (err: Error) => void;
}

export class GhForwarder {
  private child: ChildProcess | null = null;
  private readonly options: ForwarderOptions;
  private isStopping = false;

  constructor(options: ForwarderOptions) {
    this.options = options;
  }

  isRunning(): boolean {
    return this.child !== null && !this.child.killed;
  }

  start(): void {
    if (this.child) return;

    // Default to '*' to listen to ALL events from the repository
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

    try {
      this.child = spawn("gh", args, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      this.child.stdout?.on("data", (data: Buffer) => {
        const text = data.toString("utf8").trim();
        if (text && this.options.onLog) {
          this.options.onLog(text);
        }
      });

      this.child.stderr?.on("data", (data: Buffer) => {
        const text = data.toString("utf8").trim();
        if (text && !this.isStopping && this.options.onLog) {
          this.options.onLog(text);
        }
      });

      this.child.on("error", (err) => {
        if (!this.isStopping && this.options.onError) {
          this.options.onError(err);
        }
      });

      this.child.on("exit", () => {
        this.child = null;
      });
    } catch (err) {
      if (this.options.onError && err instanceof Error) {
        this.options.onError(err);
      }
    }
  }

  stop(): void {
    this.isStopping = true;
    if (this.child) {
      try {
        this.child.kill("SIGTERM");
      } catch {
        // Child process may already be dead
      }
      this.child = null;
    }
  }
}
