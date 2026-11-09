import type {
  ExtensionContext,
  ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import {
  loadProjectConfig,
  resolveGitBranch,
  resolveGitRepo,
} from "./config/loader.js";
import { WebhookEventBus } from "./bus/event-bus.js";
import { LoopbackServer } from "./transport/loopback.js";
import { GhForwarder } from "./transport/forwarder.js";
import type { GhWebhookWorkflow } from "./types/schema.js";

export type ControllerState = "unconfigured" | "running" | "stopped";

export class WebhookController {
  private state: ControllerState = "unconfigured";
  private config: GhWebhookWorkflow | null = null;
  private loopback: LoopbackServer | null = null;
  private forwarder: GhForwarder | null = null;
  private currentBranch = "main";
  private repo = "";

  constructor(private readonly pi: ExtensionAPI) {}

  getState(): ControllerState {
    return this.state;
  }

  async start(ctx: ExtensionContext): Promise<boolean> {
    if (this.state === "running") {
      return true;
    }

    const config = await loadProjectConfig(ctx.cwd);
    if (!config) {
      this.state = "unconfigured";
      this.updateStatusBar(ctx);
      return false;
    }

    this.config = config;
    this.currentBranch = await resolveGitBranch(ctx.cwd);
    const resolvedRepo =
      config.repo && config.repo !== "auto"
        ? config.repo
        : await resolveGitRepo(ctx.cwd);

    if (!resolvedRepo) {
      this.state = "unconfigured";
      this.updateStatusBar(ctx);
      if (ctx.hasUI) {
        ctx.ui.notify(
          "[ghwk] 未能检测到当前项目的 GitHub 仓库 (owner/repo)，请在配置中显式指定 'repo' 字段。",
          "warning",
        );
      }
      return false;
    }

    this.repo = resolvedRepo;
    const bus = new WebhookEventBus(config);

    this.loopback = new LoopbackServer({
      port: config.port,
      secret: config.secret,
      getStatus: () => ({
        status: "active",
        service: "pi-ghwebhook",
        repo: this.repo,
        branch: this.currentBranch,
        port: this.loopback?.getPort(),
        forwarder: this.forwarder?.isRunning() ? "running" : "stopped",
      }),
      onEvent: async (event, payload) => {
        const plans = bus.dispatch(event, payload, this.currentBranch);
        for (const plan of plans) {
          this.pi.sendUserMessage(plan.prompt, {
            deliverAs: plan.deliverAs,
          });
        }
      },
    });

    try {
      await this.loopback.start();
    } catch (err) {
      console.error("[ghwk] 无法启动回环服务:", err);
      if (ctx.hasUI) {
        ctx.ui.notify("[ghwk] 无法启动回环服务，事件流未能挂载", "error");
      }
      this.state = "stopped";
      this.updateStatusBar(ctx);
      return false;
    }

    this.forwarder = new GhForwarder({
      repo: this.repo,
      url: this.loopback.getUrl(),
      secret: config.secret,
      onError: (err) => {
        console.error("[ghwk] gh forwarder error:", err);
      },
    });

    this.forwarder.start();
    this.state = "running";
    this.updateStatusBar(ctx);
    return true;
  }

  async stop(ctx?: ExtensionContext): Promise<void> {
    if (this.forwarder) {
      this.forwarder.stop();
      this.forwarder = null;
    }
    if (this.loopback) {
      await this.loopback.stop();
      this.loopback = null;
    }
    this.state = "stopped";
    if (ctx) {
      this.updateStatusBar(ctx);
    }
  }

  async restart(ctx: ExtensionContext): Promise<boolean> {
    await this.stop(ctx);
    return this.start(ctx);
  }

  formatStatus(): string {
    if (this.state === "unconfigured") {
      return "GitHub Webhook: 未配置 (缺少 .pi/ghwebhook.json)\n可运行 /skill:setup-ghwebhook 自动生成。";
    }

    if (this.state === "stopped") {
      return `GitHub Webhook: 已暂停 (○ 处于离线状态)\n目标仓库: ${this.repo || "未知"}\n当前分支: ${this.currentBranch}\n可执行 /ghwk.start 重新建立连接。`;
    }

    const port = this.loopback ? this.loopback.getPort() : "未知";
    const triggers =
      typeof this.config?.on === "object" && this.config.on !== null
        ? Object.keys(this.config.on).join(", ")
        : String(this.config?.on ?? "所有事件");
    const jobs = this.config?.jobs
      ? Object.keys(this.config.jobs).join(", ")
      : "无";

    return [
      "GitHub Webhook: 正在监听 (● 已建立长连接)",
      `• 仓库: ${this.repo}`,
      `• 分支: ${this.currentBranch}`,
      `• 端口: ${port}`,
      `• 触发器: ${triggers}`,
      `• 配置任务: ${jobs}`,
    ].join("\n");
  }

  updateStatusBar(ctx: ExtensionContext): void {
    if (!ctx.hasUI) return;

    if (this.state === "unconfigured") {
      ctx.ui.setStatus("ghwk", undefined);
      return;
    }

    if (this.state === "stopped") {
      ctx.ui.setStatus(
        "ghwk",
        ctx.ui.theme.fg("warning", "○ ") +
          ctx.ui.theme.fg("muted", "ghwk: stopped"),
      );
      return;
    }

    ctx.ui.setStatus(
      "ghwk",
      ctx.ui.theme.fg("success", "● ") +
        ctx.ui.theme.fg("muted", `ghwk: ${this.repo} (${this.currentBranch})`),
    );
  }
}
