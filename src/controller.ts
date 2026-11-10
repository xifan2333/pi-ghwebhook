import { watch, type FSWatcher } from "node:fs";
import { join } from "node:path";
import type {
  ExtensionContext,
  ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import {
  loadProjectConfig,
  resolveGitBranch,
  resolveGitDir,
  resolveGitRepo,
} from "./config/loader.js";
import { WebhookEventBus } from "./bus/event-bus.js";
import { LoopbackServer } from "./transport/loopback.js";
import { GhForwarder, cleanupStaleWebhook } from "./transport/forwarder.js";
import {
  acquirePidLock,
  releasePidLock,
  type PidLockData,
} from "./transport/pid-lock.js";
import {
  ControllerStatus,
  ForwarderState,
  type ThemeTone,
} from "./types/enums.js";
import type { GhWebhookWorkflow } from "./types/schema.js";

export { ControllerStatus };
export type ControllerState = ControllerStatus;

interface StatusDescriptor {
  icon: string;
  tone: ThemeTone;
  getLabel: (meta: {
    repo: string;
    branch: string;
    retryCount: number;
  }) => string;
}

const FORWARDER_STATUS_TABLE: Record<ForwarderState, StatusDescriptor> = {
  [ForwarderState.Running]: {
    icon: "● ",
    tone: "success",
    getLabel: ({ repo, branch }) =>
      `ghwk: ${repo} (${branch}) [PID: ${process.pid}]`,
  },
  [ForwarderState.Reconnecting]: {
    icon: "▲ ",
    tone: "warning",
    getLabel: ({ repo, retryCount }) =>
      `ghwk: 重连中${retryCount > 0 ? ` (#${retryCount})` : ""} (${repo})`,
  },
  [ForwarderState.Stopped]: {
    icon: "× ",
    tone: "error",
    getLabel: ({ repo }) => `ghwk: 断开 (${repo})`,
  },
  [ForwarderState.Idle]: {
    icon: "○ ",
    tone: "muted",
    getLabel: () => "ghwk: 准备中",
  },
};

const STATUS_HEADER_TABLE: Record<ForwarderState, (retry: number) => string> = {
  [ForwarderState.Running]: () => "GitHub Webhook: 正在监听 (● 已建立长连接)",
  [ForwarderState.Reconnecting]: (r) =>
    `GitHub Webhook: 正在监听 (▲ 网络波动，正在自动重连第 ${r} 次)`,
  [ForwarderState.Stopped]: () => "GitHub Webhook: 异常 (× 长连接转发已中断)",
  [ForwarderState.Idle]: () => "GitHub Webhook: 离线 (○ 准备中)",
};

export class WebhookController {
  private state: ControllerStatus = ControllerStatus.Unconfigured;
  private config: GhWebhookWorkflow | null = null;
  private loopback: LoopbackServer | null = null;
  private forwarder: GhForwarder | null = null;
  private currentBranch = "main";
  private repo = "";
  private ctx: ExtensionContext | null = null;
  private cwd = "";
  private gitWatcher: FSWatcher | null = null;
  private branchDebounceTimer: NodeJS.Timeout | null = null;
  private lockHolder: PidLockData | null = null;
  private lockPath = "";

  constructor(private readonly pi: ExtensionAPI) {}

  getState(): ControllerStatus {
    return this.state;
  }

  getCurrentBranch(): string {
    return this.currentBranch;
  }

  async refreshBranch(): Promise<string> {
    if (!this.cwd) return this.currentBranch;
    try {
      const branch = await resolveGitBranch(this.cwd);
      if (branch && branch !== this.currentBranch) {
        this.currentBranch = branch;
        this.updateStatusBar(this.ctx);
      }
    } catch {
      // keep existing branch on resolution error
    }
    return this.currentBranch;
  }

  async start(ctx: ExtensionContext, force = false): Promise<boolean> {
    this.ctx = ctx;
    this.cwd = ctx.cwd;
    if (this.state === ControllerStatus.Running && !force) return true;

    const config = await loadProjectConfig(ctx.cwd);
    if (!config) return this.failUnconfigured(ctx);

    const repo = await this.resolveTargetRepo(config, ctx.cwd);
    if (!repo) {
      this.notifyMissingRepo(ctx);
      return this.failUnconfigured(ctx);
    }

    this.config = config;
    this.repo = repo;
    this.currentBranch = await resolveGitBranch(ctx.cwd);
    this.lockPath = join(this.cwd, ".pi", "ghwebhook.pid");

    const lockResult = acquirePidLock(
      this.lockPath,
      {
        pid: process.pid,
        repo: this.repo,
        branch: this.currentBranch,
        port: config.port ?? 0,
        startedAt: Date.now(),
      },
      force,
    );

    if (!lockResult.acquired) {
      this.state = ControllerStatus.Standby;
      this.lockHolder = lockResult.holder ?? null;
      this.initGitWatcher().catch(() => {});
      this.updateStatusBar(ctx);
      return true;
    }

    this.lockHolder = null;

    const loopbackOk = await this.initLoopback(config);
    if (!loopbackOk) {
      this.notifyLoopbackError(ctx);
      return false;
    }

    this.initForwarder(config);
    this.initGitWatcher().catch(() => {});

    this.state = ControllerStatus.Running;
    this.updateStatusBar(ctx);
    return true;
  }

  private async resolveTargetRepo(
    config: GhWebhookWorkflow,
    cwd: string,
  ): Promise<string | null> {
    if (config.repo && config.repo !== "auto") {
      return config.repo;
    }
    return resolveGitRepo(cwd);
  }

  private failUnconfigured(ctx: ExtensionContext): false {
    this.state = ControllerStatus.Unconfigured;
    this.updateStatusBar(ctx);
    return false;
  }

  private notifyMissingRepo(ctx: ExtensionContext): void {
    if (ctx.hasUI) {
      ctx.ui.notify(
        "[ghwk] 未能检测到当前项目的 GitHub 仓库 (owner/repo)，请在配置中显式指定 'repo' 字段。",
        "warning",
      );
    }
  }

  private notifyLoopbackError(ctx: ExtensionContext): void {
    if (ctx.hasUI) {
      ctx.ui.notify("[ghwk] 无法启动回环服务，事件流未能挂载", "error");
    }
    this.state = ControllerStatus.Stopped;
    this.updateStatusBar(ctx);
  }

  private async initLoopback(config: GhWebhookWorkflow): Promise<boolean> {
    const bus = new WebhookEventBus(config);

    this.loopback = new LoopbackServer({
      port: config.port,
      secret: config.secret,
      getStatus: () => ({
        status: "active",
        service: "pi-ghwebhook",
        repo: this.repo,
        branch: this.currentBranch,
        pid: process.pid,
        port: this.loopback?.getPort(),
        forwarder: this.forwarder ? this.forwarder.getState() : "stopped",
      }),
      onEvent: async (event, payload) => {
        await this.refreshBranch();
        const plans = bus.dispatch(event, payload, this.currentBranch);
        for (const plan of plans) {
          this.pi.sendMessage(
            {
              customType: "ghwebhook",
              content: plan.prompt,
              display: true,
              details: { event, jobId: plan.jobId },
            },
            {
              triggerTurn: true,
              deliverAs: plan.deliverAs,
            },
          );
        }
      },
    });

    try {
      await this.loopback.start();
      return true;
    } catch (err) {
      console.error("[ghwk] 无法启动回环服务:", err);
      return false;
    }
  }

  private initForwarder(config: GhWebhookWorkflow): void {
    this.forwarder = new GhForwarder({
      repo: this.repo,
      url: this.loopback!.getUrl(),
      secret: config.secret,
      onError: (err) => console.error("[ghwk] gh forwarder error:", err),
      onStatusChange: () => {
        this.updateStatusBar(this.ctx);
      },
    });
    this.forwarder.start();
  }

  private async initGitWatcher(): Promise<void> {
    const gitDir = await resolveGitDir(this.cwd);
    if (!gitDir) return;

    try {
      this.gitWatcher = watch(gitDir, (_eventType, filename) => {
        if (filename !== "HEAD") return;
        if (this.branchDebounceTimer) {
          clearTimeout(this.branchDebounceTimer);
        }
        this.branchDebounceTimer = setTimeout(() => {
          this.branchDebounceTimer = null;
          this.refreshBranch().catch(() => {});
        }, 50);
        this.branchDebounceTimer.unref();
      });
    } catch {
      // Fallback gracefully if directory watching is unsupported
    }
  }

  async stop(ctx?: ExtensionContext): Promise<void> {
    if (ctx) {
      this.ctx = ctx;
    }
    if (this.lockPath) {
      releasePidLock(this.lockPath);
    }
    this.lockHolder = null;
    this.teardownGitWatcher();
    if (this.forwarder) {
      this.forwarder.stop();
      this.forwarder = null;
    }
    if (this.loopback) {
      await this.loopback.stop();
      this.loopback = null;
    }
    this.state = ControllerStatus.Stopped;
    this.updateStatusBar(this.ctx);
  }

  private teardownGitWatcher(): void {
    if (this.gitWatcher) {
      try {
        this.gitWatcher.close();
      } catch {
        // ignore watcher closing errors
      }
      this.gitWatcher = null;
    }
    if (this.branchDebounceTimer) {
      clearTimeout(this.branchDebounceTimer);
      this.branchDebounceTimer = null;
    }
  }

  async restart(ctx: ExtensionContext): Promise<boolean> {
    await this.stop(ctx);
    if (this.repo) {
      await cleanupStaleWebhook(this.repo).catch(() => {});
    }
    return this.start(ctx, true);
  }

  formatStatus(): string {
    if (this.state === ControllerStatus.Unconfigured) {
      return "GitHub Webhook: 未配置 (缺少 .pi/ghwebhook.json)\n可运行 /skill:setup-ghwebhook 自动生成。";
    }

    if (this.state === ControllerStatus.Stopped) {
      return `GitHub Webhook: 已暂停 (○ 处于离线状态)\n目标仓库: ${this.repo || "未知"}\n当前分支: ${this.currentBranch}\n可执行 /ghwk.start 重新建立连接。`;
    }

    if (this.state === ControllerStatus.Standby) {
      const owner = this.lockHolder
        ? `\n• 活跃进程: PID ${this.lockHolder.pid} (分支: ${this.lockHolder.branch})\n• 监听端口: ${this.lockHolder.port || "动态"}`
        : "";
      return `GitHub Webhook: 处于待机状态 (○ standby)${owner}\n当前窗口已让渡长连接，执行 /ghwk.start 随时接管。`;
    }

    const forwarderState = this.forwarder?.getState() ?? ForwarderState.Stopped;
    const headerFn = STATUS_HEADER_TABLE[forwarderState];
    const statusHeader = headerFn(this.forwarder?.getRetryCount() ?? 0);

    const port = this.loopback ? this.loopback.getPort() : "未知";
    const triggers =
      typeof this.config?.on === "object" && this.config.on !== null
        ? Object.keys(this.config.on).join(", ")
        : String(this.config?.on ?? "所有事件");
    const jobs = this.config?.jobs
      ? Object.keys(this.config.jobs).join(", ")
      : "无";

    return [
      statusHeader,
      `• 仓库: ${this.repo}`,
      `• 分支: ${this.currentBranch}`,
      `• 本地进程: PID ${process.pid}`,
      `• 端口: ${port}`,
      `• 转发状态: ${forwarderState}`,
      `• 触发器: ${triggers}`,
      `• 配置任务: ${jobs}`,
    ].join("\n");
  }

  updateStatusBar(ctx?: ExtensionContext | null): void {
    const targetCtx = ctx ?? this.ctx;
    if (!targetCtx?.hasUI) return;

    if (this.state === ControllerStatus.Unconfigured) {
      targetCtx.ui.setStatus("ghwk", undefined);
      return;
    }

    if (this.state === ControllerStatus.Stopped) {
      targetCtx.ui.setStatus(
        "ghwk",
        targetCtx.ui.theme.fg("warning", "○ ") +
          targetCtx.ui.theme.fg("muted", "ghwk: stopped"),
      );
      return;
    }

    if (this.state === ControllerStatus.Standby) {
      const ownerPid = this.lockHolder ? ` (PID: ${this.lockHolder.pid})` : "";
      targetCtx.ui.setStatus(
        "ghwk",
        targetCtx.ui.theme.fg("muted", "○ ") +
          targetCtx.ui.theme.fg("muted", `ghwk: standby${ownerPid}`),
      );
      return;
    }

    const forwarderState = this.forwarder?.getState() ?? ForwarderState.Stopped;
    const item = FORWARDER_STATUS_TABLE[forwarderState];
    const label = item.getLabel({
      repo: this.repo,
      branch: this.currentBranch,
      retryCount: this.forwarder?.getRetryCount() ?? 0,
    });

    targetCtx.ui.setStatus(
      "ghwk",
      targetCtx.ui.theme.fg(item.tone, item.icon) +
        targetCtx.ui.theme.fg("muted", label),
    );
  }
}
