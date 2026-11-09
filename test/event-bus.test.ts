import test from "node:test";
import assert from "node:assert/strict";
import { WebhookEventBus } from "../dist/bus/event-bus.js";
import { EventTopic } from "../dist/types/enums.js";
import type { SubscriptionRule } from "../dist/types/schema.js";

test("event-bus - dispatches matched rules with rendered template", () => {
  const rules: SubscriptionRule[] = [
    {
      topic: EventTopic.WorkflowFailure,
      filters: {
        branch: "@current",
      },
      action: {
        prompt: "CI Failed on {{ branch }} with url {{ run_url }}",
        deliverAs: "followUp",
      },
    },
    {
      topic: EventTopic.WorkflowSuccess,
      action: {
        prompt: "CI Succeeded on {{ branch }}",
      },
    },
  ];

  const bus = new WebhookEventBus(rules);
  const payload = {
    workflow_run: {
      head_branch: "feat/issue-1",
      html_url: "https://github.com/runs/1",
    },
  };

  const plans = bus.dispatch(
    EventTopic.WorkflowFailure,
    payload,
    "feat/issue-1",
  );
  assert.equal(plans.length, 1);
  assert.equal(
    plans[0].prompt,
    "CI Failed on feat/issue-1 with url https://github.com/runs/1",
  );
  assert.equal(plans[0].deliverAs, "followUp");
});

test("event-bus - filters out non-matching branch", () => {
  const rules: SubscriptionRule[] = [
    {
      topic: EventTopic.WorkflowFailure,
      filters: {
        branch: "@current",
      },
      action: {
        prompt: "Failed",
      },
    },
  ];

  const bus = new WebhookEventBus(rules);
  const payload = {
    workflow_run: {
      head_branch: "other-branch",
    },
  };

  const plans = bus.dispatch(
    EventTopic.WorkflowFailure,
    payload,
    "feat/issue-1",
  );
  assert.equal(plans.length, 0);
});

test("event-bus - returns empty array when topic has no listeners", () => {
  const bus = new WebhookEventBus([]);
  const plans = bus.dispatch(EventTopic.WorkflowFailure, {}, "main");
  assert.equal(plans.length, 0);
});
