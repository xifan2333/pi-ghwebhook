import type { SubscriptionRule } from "../types/schema.js";
import type { WebhookPayload } from "../types/payload.js";
import { evaluateGuards } from "./guards.js";
import { extractVariables, renderTemplate } from "../template/renderer.js";

export interface ActionPlan {
  prompt: string;
  deliverAs: "steer" | "followUp";
  topic: string;
}

export class WebhookEventBus {
  private readonly routes = new Map<string, SubscriptionRule[]>();

  constructor(rules: SubscriptionRule[]) {
    for (const rule of rules) {
      const existing = this.routes.get(rule.topic) ?? [];
      existing.push(rule);
      this.routes.set(rule.topic, existing);
    }
  }

  getTopics(): string[] {
    return Array.from(this.routes.keys());
  }

  dispatch(
    topic: string,
    payload: WebhookPayload,
    currentBranch: string,
  ): ActionPlan[] {
    const matchedRules = this.routes.get(topic);
    if (!matchedRules || matchedRules.length === 0) {
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
          topic: rule.topic,
        });
      }
    }

    return plans;
  }
}
