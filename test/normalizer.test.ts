import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEventKey,
  resolveIncomingEventKeys,
} from "../dist/bus/normalizer.js";

test("normalizer - normalizeEventKey removes github. prefix", () => {
  assert.equal(
    normalizeEventKey("github.workflow_run.completed"),
    "workflow_run.completed",
  );
  assert.equal(
    normalizeEventKey("workflow_run.completed"),
    "workflow_run.completed",
  );
  assert.equal(normalizeEventKey("  github.push  "), "push");
});

test("normalizer - resolveIncomingEventKeys generates action and base keys", () => {
  const keys = resolveIncomingEventKeys("workflow_run", {
    action: "completed",
  });
  assert.deepEqual(keys, ["workflow_run.completed", "workflow_run"]);
});

test("normalizer - resolveIncomingEventKeys handles events without action", () => {
  const keys = resolveIncomingEventKeys("push", {});
  assert.deepEqual(keys, ["push"]);
});

test("normalizer - resolveIncomingEventKeys handles pull_request opened", () => {
  const keys = resolveIncomingEventKeys("pull_request", { action: "opened" });
  assert.deepEqual(keys, ["pull_request.opened", "pull_request"]);
});

test("normalizer - resolveIncomingEventKeys handles issues labeled", () => {
  const keys = resolveIncomingEventKeys("issues", { action: "labeled" });
  assert.deepEqual(keys, ["issues.labeled", "issues"]);
});
