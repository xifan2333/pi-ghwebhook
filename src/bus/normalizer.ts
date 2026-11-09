import type { WebhookPayload } from "../types/payload.js";

/**
 * Normalizes an event identifier by stripping optional "github." prefix.
 * e.g. "github.workflow_run.completed" -> "workflow_run.completed"
 */
export function normalizeEventKey(key: string): string {
  const trimmed = key.trim();
  return trimmed.startsWith("github.") ? trimmed.slice(7) : trimmed;
}

/**
 * Resolves candidate event keys from an incoming GitHub Webhook event and payload.
 * Upstream convention:
 * 1. If payload has action: `${event}.${action}` (e.g. "workflow_run.completed", "pull_request.opened")
 * 2. Wildcard/base event: `${event}` (e.g. "workflow_run", "push", "issues")
 */
export function resolveIncomingEventKeys(
  event: string,
  payload: WebhookPayload,
): string[] {
  const normalizedEvent = normalizeEventKey(event);
  const action =
    typeof payload.action === "string" ? payload.action.trim() : undefined;

  const keys: string[] = [];
  if (action) {
    keys.push(`${normalizedEvent}.${action}`);
  }
  keys.push(normalizedEvent);
  return keys;
}
