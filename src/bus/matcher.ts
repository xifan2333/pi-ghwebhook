import type { WebhookPayload } from "../types/payload.js";
import type { EventTriggerConfig } from "../types/schema.js";

export function globMatch(pattern: string, text: string): boolean {
  if (pattern === text || pattern === "*") return true;
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, ".*");
  const regex = new RegExp(`^${escaped}$`);
  return regex.test(text);
}

export function resolvePayloadBranch(
  payload: WebhookPayload,
): string | undefined {
  return (
    payload.workflow_run?.head_branch ??
    payload.pull_request?.head?.ref ??
    payload.check_suite?.head_branch ??
    payload.workflow_job?.head_branch ??
    (typeof payload.ref === "string"
      ? payload.ref.replace("refs/heads/", "")
      : undefined)
  );
}

function matchBranches(
  branches: string[],
  actualBranch: string,
  currentBranch: string,
): boolean {
  for (const pattern of branches) {
    if (pattern === "@current" && actualBranch === currentBranch) {
      return true;
    }
    if (globMatch(pattern, actualBranch)) {
      return true;
    }
  }
  return false;
}

function matchTypes(types: string[] | undefined, action: unknown): boolean {
  if (!Array.isArray(types) || types.length === 0) return true;
  const actionStr = typeof action === "string" ? action : "";
  return types.includes(actionStr);
}

function matchBranchFilter(
  branches: string[] | undefined,
  payload: WebhookPayload,
  currentBranch: string,
): boolean {
  if (!Array.isArray(branches) || branches.length === 0) return true;
  const actualBranch = resolvePayloadBranch(payload);
  return Boolean(
    actualBranch && matchBranches(branches, actualBranch, currentBranch),
  );
}

function matchWorkflows(
  workflows: string[] | undefined,
  payload: WebhookPayload,
): boolean {
  if (!Array.isArray(workflows) || workflows.length === 0) return true;
  const workflowName =
    payload.workflow_run?.name ?? payload.workflow_job?.workflow_name ?? "";
  return workflows.some((w) => globMatch(w, workflowName));
}

export function isTriggerMatched(
  trigger: EventTriggerConfig | null | undefined,
  payload: WebhookPayload,
  currentBranch: string,
): boolean {
  if (!trigger) return true;
  return (
    matchTypes(trigger.types, payload.action) &&
    matchBranchFilter(trigger.branches, payload, currentBranch) &&
    matchWorkflows(trigger.workflows, payload)
  );
}

function getNestedValue(obj: Record<string, any>, path: string): unknown {
  const parts = path.split(".");
  let current: any = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[part];
  }
  return current;
}

function resolveContextValue(
  path: string,
  payload: WebhookPayload,
  currentBranch: string,
): unknown {
  const cleanPath = path
    .replace(/^github\.event\./, "")
    .replace(/^event\./, "")
    .trim();

  // Special shortcuts
  if (cleanPath === "branch")
    return resolvePayloadBranch(payload) ?? currentBranch;
  if (cleanPath === "conclusion")
    return payload.workflow_run?.conclusion ?? payload.check_suite?.conclusion;
  if (cleanPath === "sender")
    return payload.sender?.login ?? payload.review?.user?.login;
  if (cleanPath === "isBot") {
    const senderType = payload.review?.user?.type ?? payload.sender?.type;
    const login = payload.review?.user?.login ?? payload.sender?.login ?? "";
    return senderType === "Bot" || login.endsWith("[bot]");
  }

  return getNestedValue(payload, cleanPath);
}

function parseLiteral(literal: string): string | number | boolean | null {
  const trimmed = literal.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (/^['"].*['"]$/.test(trimmed)) {
    return trimmed.slice(1, -1);
  }
  const num = Number(trimmed);
  if (!Number.isNaN(num)) return num;
  return trimmed;
}

export function evaluateCondition(
  expr: string | undefined,
  payload: WebhookPayload,
  currentBranch: string,
): boolean {
  if (!expr || !expr.trim()) return true;

  const match = expr.match(/^(.+?)\s*(===|!==|==|!=)\s*(.+)$/);
  if (!match) {
    const val = resolveContextValue(expr.trim(), payload, currentBranch);
    return Boolean(val);
  }

  const [, leftRaw, op, rightRaw] = match;
  const leftVal = resolveContextValue(leftRaw.trim(), payload, currentBranch);
  const rightVal = parseLiteral(rightRaw.trim());

  const isEqualOp = op === "==" || op === "===";

  if (
    typeof rightVal === "string" &&
    typeof leftVal === "string" &&
    rightVal.includes("*")
  ) {
    const matchesGlob = globMatch(rightVal, leftVal);
    return isEqualOp ? matchesGlob : !matchesGlob;
  }

  const areEqual = leftVal === rightVal;
  return isEqualOp ? areEqual : !areEqual;
}
