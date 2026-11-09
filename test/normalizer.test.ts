import test from "node:test";
import assert from "node:assert/strict";
import { normalizeEvent } from "../dist/bus/normalizer.js";
import { GitHubEvent, EventTopic } from "../dist/types/enums.js";

test("normalizer - workflow_run completed with failure", () => {
  const payload = {
    action: "completed",
    workflow_run: {
      conclusion: "failure",
      name: "CI",
    },
  };
  const topic = normalizeEvent(GitHubEvent.WorkflowRun, payload);
  assert.equal(topic, EventTopic.WorkflowFailure);
});

test("normalizer - workflow_run completed with success", () => {
  const payload = {
    action: "completed",
    workflow_run: {
      conclusion: "success",
      name: "CI",
    },
  };
  const topic = normalizeEvent(GitHubEvent.WorkflowRun, payload);
  assert.equal(topic, EventTopic.WorkflowSuccess);
});

test("normalizer - workflow_run completed with skipped", () => {
  const payload = {
    action: "completed",
    workflow_run: {
      conclusion: "skipped",
      name: "CI",
    },
  };
  const topic = normalizeEvent(GitHubEvent.WorkflowRun, payload);
  assert.equal(topic, EventTopic.WorkflowSkipped);
});

test("normalizer - workflow_run in_progress returns null", () => {
  const payload = {
    action: "in_progress",
    workflow_run: {
      conclusion: null,
      name: "CI",
    },
  };
  const topic = normalizeEvent(GitHubEvent.WorkflowRun, payload);
  assert.equal(topic, null);
});

test("normalizer - pull_request_review bot submitted", () => {
  const payload = {
    action: "submitted",
    review: {
      state: "commented",
      user: {
        login: "coderabbitai[bot]",
        type: "Bot",
      },
    },
  };
  const topic = normalizeEvent(GitHubEvent.PullRequestReview, payload);
  assert.equal(topic, EventTopic.ReviewBotSubmitted);
});

test("normalizer - pull_request_review human submitted", () => {
  const payload = {
    action: "submitted",
    review: {
      state: "commented",
      user: {
        login: "xifan",
        type: "User",
      },
    },
  };
  const topic = normalizeEvent(GitHubEvent.PullRequestReview, payload);
  assert.equal(topic, EventTopic.ReviewHumanSubmitted);
});

test("normalizer - pull_request_review changes_requested", () => {
  const payload = {
    action: "submitted",
    review: {
      state: "changes_requested",
      user: {
        login: "reviewer",
        type: "User",
      },
    },
  };
  const topic = normalizeEvent(GitHubEvent.PullRequestReview, payload);
  assert.equal(topic, EventTopic.ReviewChangesRequested);
});

test("normalizer - unhandled event returns null", () => {
  const topic = normalizeEvent("unknown_event", {});
  assert.equal(topic, null);
});
