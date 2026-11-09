import test from "node:test";
import assert from "node:assert/strict";
import { WebhookController } from "../dist/controller.js";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";

test("controller - dynamic branch refresh", async () => {
  const dummyPi: Partial<ExtensionAPI> = {
    sendUserMessage: () => {},
  };

  const controller = new WebhookController(dummyPi as ExtensionAPI);
  assert.equal(controller.getCurrentBranch(), "main");

  // In this repo, resolveGitBranch returns the actual git branch (main)
  const current = await controller.refreshBranch();
  assert.ok(typeof current === "string");
  assert.ok(current.length > 0);

  // Status updates without crashing even if ctx is not yet present
  assert.equal(controller.getCurrentBranch(), current);

  // Status with mocked context
  let statusSet = "";
  const mockCtx = {
    cwd: process.cwd(),
    hasUI: true,
    ui: {
      setStatus: (_id: string, text?: string) => {
        statusSet = text ?? "";
      },
      theme: {
        fg: (_color: string, text: string) => text,
      },
      notify: () => {},
    },
  } as unknown as ExtensionContext;

  controller.updateStatusBar(mockCtx);
  // Default unconfigured status is undefined (cleared)
  assert.equal(statusSet, "");
});
