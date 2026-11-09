import type { SubscriptionRule } from "../types/schema.js";
import type { WebhookPayload } from "../types/payload.js";
import { evaluateGuards } from "./guards.js";
import { normalizeEventKey, resolveIncomingEventKeys } from "./normalizer.js";
import { extractVariables, renderTemplate } from "../template/renderer.js";

export interface ActionPlan {
  prompt: string;
  deliverAs: "steer" | "followUp";
  event: string;
}

export class WebhookEventBus {
  private readonly routes = new Map<string, SubscriptionRule[]>();

  constructor(rules: SubscriptionRule[]) {
    for (const rule of rules) {
      const rawKey = rule.event ?? rule.topic;
      if (!rawKey) continue;
      const normalizedKey = normalizeEventKey(rawKey);

      const existing = this.routes.get(normalizedKey) ?? [];
      existing.push(rule);
      this.routes.set(normalizedKey, existing);
    }
  }

  getEvents(): string[] {
    return Array.from(this.routes.keys());
  }

  dispatch(
    event: string,
    payload: WebhookPayload,
    currentBranch: string,
  ): ActionPlan[] {
    const candidateKeys = resolveIncomingEventKeys(event, payload);
    const seenRules = new Set<SubscriptionRule>();
    const matchedRules: SubscriptionRule[] = [];

    for (const key of candidateKeys) {
      const rules = this.routes.get(key);
      if (!rules) continue;
      for (const rule of rules) {
        if (!seenRules.has(rule)) {
          seenRules.add(rule);
          matchedRules.push(rule);
        }
      }
    }

    if (matchedRules.length === 0) {
      return [];
    }

    const ctx = { currentBranch, payload };
    const vars = extractVariables(payload, currentBranch);
    const plans: ActionPlan[] = [];

    for (const rule of matchedRules) {
      if (evaluateGuards(rule.filters, ctx)) {
        plans.push({
          prompt: renderTemplate(rule.action.prompt, vars),
          deliverAs: rule.action.deliverAs ?? "followUp",
          event: rule.event ?? rule.topic ?? event,
        });
      }
    }

    return plans;
  }
}
