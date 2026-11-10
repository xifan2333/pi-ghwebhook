import test from "node:test";
import assert from "node:assert/strict";
import {
  renderGhWebhookMessage,
  NF_ICONS,
} from "../dist/ui/message-renderer.js";
import { Box } from "@earendil-works/pi-tui";

function createMockTheme() {
  const fgCalls: Array<{ color: string; text: string }> = [];
  const bgCalls: Array<{ color: string; text: string }> = [];

  const theme = {
    fg(color: string, text: string) {
      fgCalls.push({ color, text });
      return `[fg:${color}]${text}[/fg]`;
    },
    bg(color: string, text: string) {
      bgCalls.push({ color, text });
      return `[bg:${color}]${text}[/bg]`;
    },
    bold(text: string) {
      return `[bold]${text}[/bold]`;
    },
  };

  return { theme, fgCalls, bgCalls };
}

test("message-renderer - renders collapsed card with Nerd Font icons and theme tokens", () => {
  const { theme, bgCalls, fgCalls } = createMockTheme();

  const message = {
    customType: "ghwebhook",
    content: "Run test suite on branch",
    details: {
      event: "pull_request",
      jobId: "pr-review",
      repo: "owner/repo",
      branch: "feat/cool-feature",
      action: "opened",
      timestamp: Date.now(),
    },
  };

  const options = {
    expanded: false,
    outputPad: 2,
    keyText: () => "ctrl+o",
    keyHint: (_key: string, desc: string) => `ctrl+o ${desc}`,
  };

  const component = renderGhWebhookMessage(
    message as any,
    options,
    theme as any,
  );
  assert.ok(component instanceof Box);

  const rendered = component.render(100);
  const fullText = rendered.join("\n");

  // Verify Nerd Font icons are present
  assert.ok(fullText.includes(NF_ICONS.github), "contains GitHub icon");
  assert.ok(fullText.includes(NF_ICONS.link), "contains link icon");
  assert.ok(fullText.includes(NF_ICONS.branch), "contains branch icon");
  assert.ok(fullText.includes(NF_ICONS.action), "contains action icon");

  // Verify content and metadata
  assert.ok(fullText.includes("pull_request:opened"));
  assert.ok(fullText.includes("feat/cool-feature"));
  assert.ok(fullText.includes("pr-review"));
  assert.ok(fullText.includes("Run test suite on branch"));

  // Verify theme tokens used
  assert.ok(bgCalls.some((c) => c.color === "customMessageBg"));
  assert.ok(fgCalls.some((c) => c.color === "customMessageLabel"));
  assert.ok(fgCalls.some((c) => c.color === "customMessageText"));
  assert.ok(fgCalls.some((c) => c.color === "accent"));
  assert.ok(fgCalls.some((c) => c.color === "success"));
});

test("message-renderer - renders expanded card with tree metadata", () => {
  const { theme } = createMockTheme();

  const message = {
    customType: "ghwebhook",
    content: "Investigate CI failure",
    details: {
      event: "workflow_run",
      jobId: "ci-fix",
      repo: "org/project",
      branch: "main",
      action: "completed",
      timestamp: 1700000000000,
    },
  };

  const options = {
    expanded: true,
    outputPad: 1,
    keyText: () => "ctrl+o",
    keyHint: () => "ctrl+o",
  };

  const component = renderGhWebhookMessage(
    message as any,
    options,
    theme as any,
  );
  assert.ok(component instanceof Box);

  const rendered = component.render(100);
  const fullText = rendered.join("\n");

  // Verify tree structure
  assert.ok(fullText.includes("├─"));
  assert.ok(fullText.includes("└─"));

  // Verify metadata fields
  assert.ok(fullText.includes("org/project"));
  assert.ok(fullText.includes("main"));
  assert.ok(fullText.includes("ci-fix"));
  assert.ok(fullText.includes("completed"));
  assert.ok(fullText.includes("Investigate CI failure"));
});

test("message-renderer - handles missing or partial details safely", () => {
  const { theme } = createMockTheme();

  const message = {
    customType: "ghwebhook",
    content: "Raw message without details",
  };

  const options = {
    expanded: false,
    outputPad: 0,
    keyText: () => "",
    keyHint: () => "",
  };

  const component = renderGhWebhookMessage(
    message as any,
    options,
    theme as any,
  );
  assert.ok(component instanceof Box);

  const rendered = component.render(80);
  const fullText = rendered.join("\n");
  assert.ok(fullText.includes("Raw message without details"));
  assert.ok(fullText.includes("webhook"));
});
