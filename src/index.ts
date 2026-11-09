import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  loadProjectConfig,
  resolveGitBranch,
  resolveGitRepo,
} from "./config/loader.js";
import { WebhookEventBus } from "./bus/event-bus.js";
import { LoopbackServer } from "./transport/loopback.js";
import { GhForwarder } from "./transport/forwarder.js";

export default function ghWebhookExtension(pi: ExtensionAPI): void {
  let loopback: LoopbackServer | null = null;
  let forwarder: GhForwarder | null = null;

  const cleanup = async () => {
    if (forwarder) {
      forwarder.stop();
      forwarder = null;
    }
    if (loopback) {
      await loopback.stop();
      loopback = null;
    }
  };

  process.once("exit", () => {
    if (forwarder) forwarder.stop();
  });

  pi.on("session_start", async (_event, ctx) => {
    // 1. 工作区探测：若当前项目无 .pi/ghwebhook.json，则静默休眠，零资源占用
    const config = await loadProjectConfig(ctx.cwd);
    if (!config) {
      return;
    }

    // 2. 解析当前 Git 分支与远端仓库
    const currentBranch = await resolveGitBranch(ctx.cwd);
    const repo =
      config.repo && config.repo !== "auto"
        ? config.repo
        : await resolveGitRepo(ctx.cwd);

    if (!repo) {
      if (ctx.hasUI) {
        ctx.ui.notify(
          "[pi-ghwebhook] 未能检测到当前项目的 GitHub 仓库 (owner/repo)，请在配置中显式指定 'repo' 字段。",
          "warning",
        );
      }
      return;
    }

    // 3. 构建 GitHub Actions Workflow 事件总线
    const bus = new WebhookEventBus(config);

    // 4. 启动随机端口本地回环服务器
    loopback = new LoopbackServer({
      port: config.port,
      secret: config.secret,
      getStatus: () => ({
        status: "active",
        service: "pi-ghwebhook",
        name: config.name ?? "GitHub Webhook Automation",
        repo,
        branch: currentBranch,
        port: loopback?.getPort(),
        url: loopback?.getUrl(),
        forwarder: forwarder?.isRunning() ? "running" : "stopped",
        triggers:
          typeof config.on === "object" && config.on !== null
            ? Object.keys(config.on)
            : config.on,
      }),
      onEvent: async (event, payload) => {
        const plans = bus.dispatch(event, payload, currentBranch);
        for (const plan of plans) {
          pi.sendUserMessage(plan.prompt, {
            deliverAs: plan.deliverAs,
          });
        }
      },
    });

    try {
      await loopback.start();
    } catch (err) {
      console.error("[pi-ghwebhook] 无法启动回环服务:", err);
      if (ctx.hasUI) {
        ctx.ui.notify(
          "[pi-ghwebhook] 无法启动回环服务，事件流未能挂载",
          "error",
        );
      }
      return;
    }

    // 5. 托管 gh webhook forward 长连接子进程（全量监听）
    forwarder = new GhForwarder({
      repo,
      url: loopback.getUrl(),
      secret: config.secret,
      onError: (err) => {
        console.error("[pi-ghwebhook] gh forwarder error:", err);
      },
    });

    forwarder.start();

    if (ctx.hasUI) {
      const displayName = config.name ? `[${config.name}]` : "[pi-ghwebhook]";
      ctx.ui.notify(
        `${displayName} 已监听 ${repo} (${currentBranch}) 事件流 (端口: ${loopback.getPort()})`,
        "info",
      );
    }
  });

  pi.on("session_shutdown", async () => {
    await cleanup();
  });
}
