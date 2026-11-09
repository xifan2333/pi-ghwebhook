import test from "node:test";
import assert from "node:assert/strict";
import { WebhookEventBus } from "../dist/bus/event-bus.js";
import type { SubscriptionRule } from "../dist/types/schema.js";

test("event-bus - dispatches upstream event with conclusion filter", () => {
  const rules: SubscriptionRule[] = [
    {
      event: "workflow_run.completed",
      filters: {
        branch: "@current",
        conclusion: "failure",
      },
      action: {
        prompt: "CI Failed on {{ branch }} with url {{ run_url }}",
        deliverAs: "followUp",
      },
    },
    {
      event: "workflow_run.completed",
      filters: {
        conclusion: "success",
      },
      action: {
        prompt: "CI Succeeded on {{ branch }}",
      },
    },
  ];

  const bus = new WebhookEventBus(rules);
  const failurePayload = {
    action: "completed",
    workflow_run: {
      head_branch: "feat/issue-1",
      conclusion: "failure",
      html_url: "https://github.com/runs/1",
    },
  };

  const plans = bus.dispatch("workflow_run", failurePayload, "feat/issue-1");
  assert.equal(plans.length, 1);
  assert.equal(
    plans[0].prompt,
    "CI Failed on feat/issue-1 with url https://github.com/runs/1",
  );
  assert.equal(plans[0].deliverAs, "followUp");
});

test("event-bus - dispatches any event like issues.opened and push", () => {
  const rules: SubscriptionRule[] = [
    {
      event: "issues.opened",
      action: {
        prompt: "New Issue: #{{ issue_number }} {{ issue_title }}",
      },
    },
    {
      event: "push",
      filters: {
        branch: "main",
      },
      action: {
        prompt: "Push to main: {{ head_sha }}",
      },
    },
  ];

  const bus = new WebhookEventBus(rules);

  // 1. Issue opened
  const issuePayload = {
    action: "opened",
    issue: {
      number: 101,
      title: "Bug in parser",
    },
  };
  const issuePlans = bus.dispatch("issues", issuePayload, "main");
  assert.equal(issuePlans.length, 1);
  assert.equal(issuePlans[0].prompt, "New Issue: #101 Bug in parser");

  // 2. Push event
  const pushPayload = {
    ref: "refs/heads/main",
    after: "c0ffee123456",
  };
  const pushPlans = bus.dispatch("push", pushPayload, "main");
  assert.equal(pushPlans.length, 1);
  assert.equal(pushPlans[0].prompt, "Push to main: c0ffee123456");
});

test("event-bus - filters out non-matching branch", () => {
  const rules: SubscriptionRule[] = [
    {
      event: "workflow_run.completed",
      filters: {
        branch: "@current",
      },
      action: {
        prompt: "Completed",
      },
    },
  ];

  const bus = new WebhookEventBus(rules);
  const payload = {
    action: "completed",
    workflow_run: {
      head_branch: "other-branch",
    },
  };

  const plans = bus.dispatch("workflow_run", payload, "feat/issue-1");
  assert.equal(plans.length, 0);
});

test("event-bus - returns empty array when event has no listeners", () => {
  const bus = new WebhookEventBus([]);
  const plans = bus.dispatch("workflow_run", {}, "main");
  assert.equal(plans.length, 0);
});
