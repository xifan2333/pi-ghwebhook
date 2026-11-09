import test from "node:test";
import assert from "node:assert/strict";
import {
  globMatch,
  isTriggerMatched,
  evaluateCondition,
} from "../dist/bus/matcher.js";

test("matcher - globMatch handles wildcards and patterns", () => {
  assert.equal(globMatch("main", "main"), true);
  assert.equal(globMatch("feat/*", "feat/new-ui"), true);
  assert.equal(globMatch("feat/*", "fix/bug"), false);
  assert.equal(globMatch("*[bot]", "coderabbitai[bot]"), true);
  assert.equal(globMatch("*[bot]", "xifan"), false);
  assert.equal(globMatch("*", "anything"), true);
});

test("matcher - isTriggerMatched checks types, branches and workflows", () => {
  const trigger = {
    types: ["completed"],
    branches: ["@current", "releases/**"],
    workflows: ["CI*"],
  };

  const matchingPayload = {
    action: "completed",
    workflow_run: {
      name: "CI / Matrix",
      head_branch: "feat/dev",
    },
  };

  assert.equal(isTriggerMatched(trigger, matchingPayload, "feat/dev"), true);

  // Mismatched action
  assert.equal(
    isTriggerMatched(
      trigger,
      { ...matchingPayload, action: "in_progress" },
      "feat/dev",
    ),
    false,
  );

  // Mismatched branch
  assert.equal(
    isTriggerMatched(trigger, matchingPayload, "other-branch"),
    false,
  );

  // Mismatched workflow name
  const wrongWfPayload = {
    action: "completed",
    workflow_run: { name: "Deploy", head_branch: "feat/dev" },
  };
  assert.equal(isTriggerMatched(trigger, wrongWfPayload, "feat/dev"), false);
});

test("matcher - evaluateCondition evaluates expressions safely", () => {
  const payload = {
    workflow_run: {
      conclusion: "failure",
    },
    sender: {
      login: "coderabbitai[bot]",
      type: "Bot",
    },
  };

  assert.equal(
    evaluateCondition(
      "github.event.workflow_run.conclusion == 'failure'",
      payload,
      "main",
    ),
    true,
  );
  assert.equal(
    evaluateCondition(
      "github.event.workflow_run.conclusion == 'success'",
      payload,
      "main",
    ),
    false,
  );
  assert.equal(
    evaluateCondition("github.event.sender.type == 'Bot'", payload, "main"),
    true,
  );
  assert.equal(
    evaluateCondition("github.event.sender.login == '*[bot]'", payload, "main"),
    true,
  );
  assert.equal(
    evaluateCondition("conclusion != 'success'", payload, "main"),
    true,
  );
  assert.equal(evaluateCondition(undefined, payload, "main"), true);
});
