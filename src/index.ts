import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { WebhookController } from "./controller.js";

export default function ghWebhookExtension(pi: ExtensionAPI): void {
  const controller = new WebhookController(pi);

  process.once("exit", () => {
    controller.stop().catch(() => {});
  });

  // 1. 生命周期绑定
  pi.on("session_start", async (_event, ctx) => {
    await controller.start(ctx);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    await controller.stop(ctx);
  });

  // 2. 实时分支同步（终端命令或 Agent 执行后立即刷新）
  pi.on("user_bash", async () => {
    await controller.refreshBranch();
  });

  pi.on("agent_settled", async () => {
    await controller.refreshBranch();
  });

  pi.on("session_tree", async () => {
    await controller.refreshBranch();
  });

  // 3. 原生 TUI 控制命令注册 (ghwk.*)
  pi.registerCommand("ghwk.status", {
    description: "显示 GitHub Webhook 当前长连接状态与配置信息",
    handler: async (_args, ctx) => {
      await controller.refreshBranch();
      ctx.ui.notify(controller.formatStatus(), "info");
    },
  });

  pi.registerCommand("ghwk.start", {
    description: "手动启动本地 Webhook 回环服务并建立 GitHub 长连接",
    handler: async (_args, ctx) => {
      const ok = await controller.start(ctx);
      if (ok) {
        ctx.ui.notify("GitHub Webhook: 已启动监听并建立长连接", "info");
      }
    },
  });

  pi.registerCommand("ghwk.stop", {
    description: "手动暂停 GitHub Webhook 监听并断开长连接",
    handler: async (_args, ctx) => {
      await controller.stop(ctx);
      ctx.ui.notify("GitHub Webhook: 已暂停监听并释放本地连接", "info");
    },
  });

  pi.registerCommand("ghwk.restart", {
    description: "重新加载配置并热重启 GitHub Webhook 长连接服务",
    handler: async (_args, ctx) => {
      const ok = await controller.restart(ctx);
      if (ok) {
        ctx.ui.notify("GitHub Webhook: 已重新加载配置并重置连接", "info");
      }
    },
  });
}
