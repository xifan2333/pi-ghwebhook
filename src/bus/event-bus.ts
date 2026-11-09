import type { GhWebhookWorkflow, EventTriggerConfig } from "../types/schema.js";
import type { WebhookPayload } from "../types/payload.js";
import { isTriggerMatched, evaluateCondition } from "./matcher.js";
import { extractVariables, renderTemplate } from "../template/renderer.js";

export interface ActionPlan {
  prompt: string;
  deliverAs: "steer" | "followUp";
  jobId: string;
}

export class WebhookEventBus {
  constructor(private readonly workflow: GhWebhookWorkflow) {}

  private getTriggerForEvent(
    incomingEvent: string,
  ): EventTriggerConfig | null | undefined {
    const on = this.workflow.on;
    if (typeof on === "string") {
      return on === incomingEvent ? null : undefined;
    }
    if (Array.isArray(on)) {
      return on.includes(incomingEvent) ? null : undefined;
    }
    if (typeof on === "object" && on !== null) {
      if (Object.prototype.hasOwnProperty.call(on, incomingEvent)) {
        return on[incomingEvent] as EventTriggerConfig | null;
      }
    }
    return undefined;
  }

  dispatch(
    incomingEvent: string,
    payload: WebhookPayload,
    currentBranch: string,
  ): ActionPlan[] {
    const trigger = this.getTriggerForEvent(incomingEvent);
    if (trigger === undefined) {
      return [];
    }

    if (!isTriggerMatched(trigger, payload, currentBranch)) {
      return [];
    }

    const vars = extractVariables(payload, currentBranch);
    const plans: ActionPlan[] = [];

    for (const [jobId, job] of Object.entries(this.workflow.jobs)) {
      if (!evaluateCondition(job.if, payload, currentBranch)) {
        continue;
      }

      plans.push({
        prompt: renderTemplate(job.prompt, vars),
        deliverAs: job.deliverAs ?? "followUp",
        jobId,
      });
    }

    return plans;
  }
}
