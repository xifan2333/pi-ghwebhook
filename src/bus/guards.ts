import type { WebhookPayload } from "../types/payload.js";
import type { FilterConfig } from "../types/schema.js";

export interface FilterContext {
  currentBranch: string;
  payload: WebhookPayload;
}

export type GuardPredicate = (
  expectedValue: unknown,
  ctx: FilterContext,
) => boolean;

function resolvePayloadBranch(payload: WebhookPayload): string | undefined {
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

function resolvePayloadSender(payload: WebhookPayload): string | undefined {
  return (
    payload.sender?.login ??
    payload.review?.user?.login ??
    payload.comment?.user?.login
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

const branchGuard: GuardPredicate = (expected, { currentBranch, payload }) => {
  const target = expected === "@current" ? currentBranch : expected;
  const actualBranch = resolvePayloadBranch(payload);
  return typeof target === "string" && actualBranch === target;
};

const conclusionGuard: GuardPredicate = (expected, { payload }) => {
  const actual =
    payload.workflow_run?.conclusion ??
    payload.check_suite?.conclusion ??
    payload.workflow_job?.conclusion;
  return typeof expected === "string" && actual === expected;
};

const workflowGuard: GuardPredicate = (expected, { payload }) => {
  const workflowName =
    payload.workflow_run?.name ?? payload.workflow_job?.workflow_name;
  return typeof expected === "string" && workflowName === expected;
};

const stateGuard: GuardPredicate = (expected, { payload }) => {
  const actual = payload.review?.state ?? payload.pull_request?.state;
  return typeof expected === "string" && actual === expected;
};

const sendersGuard: GuardPredicate = (allowedList, { payload }) => {
  if (!Array.isArray(allowedList)) return true;
  const sender = resolvePayloadSender(payload);
  return typeof sender === "string" && allowedList.includes(sender);
};

const isBotGuard: GuardPredicate = (expected, { payload }) => {
  const senderType = payload.review?.user?.type ?? payload.sender?.type;
  const login = payload.review?.user?.login ?? payload.sender?.login ?? "";
  const isBot = senderType === "Bot" || login.endsWith("[bot]");
  return isBot === Boolean(expected);
};

const matchGuard: GuardPredicate = (matchObj, { payload }) => {
  if (!matchObj || typeof matchObj !== "object") return true;
  for (const [path, expected] of Object.entries(
    matchObj as Record<string, unknown>,
  )) {
    const actual = getNestedValue(payload, path);
    if (actual !== expected) return false;
  }
  return true;
};

export const GUARDS: ReadonlyMap<keyof FilterConfig, GuardPredicate> = new Map([
  ["branch", branchGuard],
  ["conclusion", conclusionGuard],
  ["workflow", workflowGuard],
  ["state", stateGuard],
  ["senders", sendersGuard],
  ["isBot", isBotGuard],
  ["match", matchGuard],
]);

export function evaluateGuards(
  filters: FilterConfig | undefined,
  ctx: FilterContext,
): boolean {
  if (!filters) return true;

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined) continue;
    const guard = GUARDS.get(key as keyof FilterConfig);
    if (guard && !guard(value, ctx)) {
      return false;
    }
  }

  return true;
}
