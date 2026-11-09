import test from "node:test";
import assert from "node:assert/strict";
import { WebhookEventBus } from "../dist/bus/event-bus.js";
import type { GhWebhookWorkflow } from "../dist/types/schema.js";

test("event-bus - dispatches workflow_run with on and jobs", () => {
  const workflow: GhWebhookWorkflow = {
    name: "CI Test",
    on: {
      workflow_run: {
        types: ["completed"],
        branches: ["@current"],
      },
    },
    jobs: {
      "on-failure": {
        if: "github.event.workflow_run.conclusion == 'failure'",
        prompt: "CI Failed on {{ branch }} with url {{ run_url }}",
        deliverAs: "followUp",
      },
      "on-success": {
        if: "github.event.workflow_run.conclusion == 'success'",
        prompt: "CI Succeeded on {{ branch }}",
        deliverAs: "followUp",
      },
    },
  };

  const bus = new WebhookEventBus(workflow);
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
  assert.equal(plans[0].jobId, "on-failure");
  assert.equal(
    plans[0].prompt,
    "CI Failed on feat/issue-1 with url https://github.com/runs/1",
  );
  assert.equal(plans[0].deliverAs, "followUp");
});

test("event-bus - ignores unlisted events", () => {
  const workflow: GhWebhookWorkflow = {
    on: {
      workflow_run: {
        types: ["completed"],
      },
    },
    jobs: {
      alert: {
        prompt: "Alert",
      },
    },
  };

  const bus = new WebhookEventBus(workflow);
  const plans = bus.dispatch("issues", { action: "opened" }, "main");
  assert.equal(plans.length, 0);
});

test("event-bus - supports string or array triggers in on", () => {
  const workflow: GhWebhookWorkflow = {
    on: ["push", "issues"],
    jobs: {
      notify: {
        prompt: "Event received",
      },
    },
  };

  const bus = new WebhookEventBus(workflow);
  const pushPlans = bus.dispatch("push", {}, "main");
  assert.equal(pushPlans.length, 1);
  assert.equal(pushPlans[0].jobId, "notify");

  const issuePlans = bus.dispatch("issues", {}, "main");
  assert.equal(issuePlans.length, 1);
});
