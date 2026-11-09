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

const branchGuard: GuardPredicate = (expected, { currentBranch, payload }) => {
  const target = expected === "@current" ? currentBranch : expected;
  const actualBranch = resolvePayloadBranch(payload);
  return typeof target === "string" && actualBranch === target;
};

const workflowGuard: GuardPredicate = (expected, { payload }) => {
  const workflowName = payload.workflow_run?.name;
  return typeof expected === "string" && workflowName === expected;
};

const sendersGuard: GuardPredicate = (allowedList, { payload }) => {
  if (!Array.isArray(allowedList)) return true;
  const sender = resolvePayloadSender(payload);
  return typeof sender === "string" && allowedList.includes(sender);
};

const conclusionGuard: GuardPredicate = (expected, { payload }) => {
  const actual =
    payload.workflow_run?.conclusion ?? payload.check_suite?.conclusion;
  return typeof expected === "string" && actual === expected;
};

const stateGuard: GuardPredicate = (expected, { payload }) => {
  const actual = payload.review?.state;
  return typeof expected === "string" && actual === expected;
};

export const GUARDS: ReadonlyMap<keyof FilterConfig, GuardPredicate> = new Map([
  ["branch", branchGuard],
  ["workflow", workflowGuard],
  ["senders", sendersGuard],
  ["conclusion", conclusionGuard],
  ["state", stateGuard],
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
