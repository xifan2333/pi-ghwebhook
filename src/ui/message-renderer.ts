import type {
  MessageRenderer,
  MessageRenderOptions,
  Theme,
} from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import { Box, Text } from "@earendil-works/pi-tui";

export interface GhWebhookMessageDetails {
  event: string;
  jobId: string;
  repo?: string;
  branch?: string;
  action?: string;
  timestamp?: number;
}

export type GhWebhookCustomMessage = Parameters<
  MessageRenderer<GhWebhookMessageDetails>
>[0];

/**
 * Nerd Font glyphs for Git & GitHub metadata.
 * Unicode escape sequences ensure cross-platform compatibility across source encodings.
 */
export const NF_ICONS = {
  github: "\uF408", //  nf-oct-mark_github
  branch: "\uE725", //  nf-dev-git_branch
  link: "\uF0C1", //  nf-fa-link
  action: "\uF489", //  nf-oct-terminal
  clock: "\uF017", //  nf-fa-clock_o
} as const;

export function extractContentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter(
        (c) =>
          c &&
          typeof c === "object" &&
          "text" in c &&
          typeof c.text === "string",
      )
      .map((c) => c.text)
      .join("\n");
  }
  return "";
}

function buildCollapsedLines(
  details: GhWebhookMessageDetails | undefined,
  messageContent: unknown,
  keyHint: MessageRenderOptions["keyHint"] | undefined,
  theme: Theme,
): string[] {
  const eventName = details?.event ?? "webhook";
  const action = details?.action;
  const parts: string[] = [
    theme.fg(
      "customMessageLabel",
      theme.bold(`${NF_ICONS.github} GitHub Webhook`),
    ),
    theme.fg(
      "accent",
      `${NF_ICONS.link} ${eventName}${action ? `:${action}` : ""}`,
    ),
  ];

  if (details?.branch) {
    parts.push(theme.fg("muted", `${NF_ICONS.branch} ${details.branch}`));
  }
  if (details?.jobId) {
    parts.push(theme.fg("success", `${NF_ICONS.action} ${details.jobId}`));
  }

  const hint = keyHint?.("app.tools.expand", "展开详情");
  if (hint) {
    parts.push(theme.fg("dim", `(${hint})`));
  }

  const lines = [parts.join("  ")];
  const contentText = extractContentText(messageContent);
  if (contentText) {
    lines.push("", theme.fg("customMessageText", contentText));
  }
  return lines;
}

function buildMetaLines(
  details: GhWebhookMessageDetails | undefined,
  theme: Theme,
): string[] {
  const meta: string[] = [];
  if (details?.repo) {
    meta.push(
      `${theme.fg("muted", `${NF_ICONS.github} 仓库:`)} ${theme.fg("customMessageText", details.repo)}`,
    );
  }
  if (details?.branch) {
    meta.push(
      `${theme.fg("muted", `${NF_ICONS.branch} 分支:`)} ${theme.fg("customMessageText", details.branch)}`,
    );
  }
  if (details?.jobId) {
    meta.push(
      `${theme.fg("muted", `${NF_ICONS.action} 任务:`)} ${theme.fg("success", details.jobId)}`,
    );
  }
  if (details?.action) {
    meta.push(
      `${theme.fg("muted", `${NF_ICONS.link} 动作:`)} ${theme.fg("dim", details.action)}`,
    );
  }
  if (details?.timestamp) {
    const timeStr = new Date(details.timestamp).toLocaleTimeString();
    meta.push(
      `${theme.fg("muted", `${NF_ICONS.clock} 时间:`)} ${theme.fg("dim", timeStr)}`,
    );
  }
  return meta;
}

function buildExpandedLines(
  details: GhWebhookMessageDetails | undefined,
  messageContent: unknown,
  theme: Theme,
): string[] {
  const eventName = details?.event ?? "webhook";
  const lines: string[] = [
    `${theme.fg("customMessageLabel", theme.bold(`${NF_ICONS.github} GitHub Webhook Event`))}  ${theme.fg("accent", `${NF_ICONS.link} ${eventName}`)}`,
  ];

  const metaLines = buildMetaLines(details, theme);
  for (let i = 0; i < metaLines.length; i++) {
    const isLast = i === metaLines.length - 1;
    const prefix = theme.fg("dim", isLast ? "└─ " : "├─ ");
    lines.push(`${prefix}${metaLines[i]}`);
  }

  const contentText = extractContentText(messageContent);
  if (contentText) {
    lines.push("", theme.fg("customMessageText", contentText));
  }
  return lines;
}

export function renderGhWebhookMessage(
  message: GhWebhookCustomMessage,
  options: MessageRenderOptions,
  theme: Theme,
): Component {
  const { expanded, outputPad, keyHint } = options;
  const box = new Box(Math.max(1, outputPad ?? 1), 1, (t: string) =>
    theme.bg("customMessageBg", t),
  );

  const lines = expanded
    ? buildExpandedLines(message.details, message.content, theme)
    : buildCollapsedLines(message.details, message.content, keyHint, theme);

  box.addChild(new Text(lines.join("\n"), 0, 0));
  return box;
}
