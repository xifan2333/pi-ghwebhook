import test from "node:test";
import assert from "node:assert/strict";
import { evaluateGuards } from "../dist/bus/guards.js";

test("guards - matches @current branch", () => {
  const ctx = {
    currentBranch: "feat/new-ui",
    payload: {
      workflow_run: {
        head_branch: "feat/new-ui",
      },
    },
  };
  const result = evaluateGuards({ branch: "@current" }, ctx);
  assert.equal(result, true);
});

test("guards - rejects non-matching branch", () => {
  const ctx = {
    currentBranch: "feat/new-ui",
    payload: {
      workflow_run: {
        head_branch: "main",
      },
    },
  };
  const result = evaluateGuards({ branch: "@current" }, ctx);
  assert.equal(result, false);
});

test("guards - matches conclusion filter", () => {
  const ctx = {
    currentBranch: "main",
    payload: {
      workflow_run: {
        head_branch: "main",
        conclusion: "failure",
      },
    },
  };
  assert.equal(evaluateGuards({ conclusion: "failure" }, ctx), true);
  assert.equal(evaluateGuards({ conclusion: "success" }, ctx), false);
});

test("guards - matches isBot filter", () => {
  const botCtx = {
    currentBranch: "main",
    payload: {
      sender: {
        login: "coderabbitai[bot]",
        type: "Bot",
      },
    },
  };
  const humanCtx = {
    currentBranch: "main",
    payload: {
      sender: {
        login: "xifan",
        type: "User",
      },
    },
  };
  assert.equal(evaluateGuards({ isBot: true }, botCtx), true);
  assert.equal(evaluateGuards({ isBot: false }, botCtx), false);
  assert.equal(evaluateGuards({ isBot: true }, humanCtx), false);
  assert.equal(evaluateGuards({ isBot: false }, humanCtx), true);
});

test("guards - matches arbitrary nested match filter", () => {
  const ctx = {
    currentBranch: "main",
    payload: {
      review: {
        state: "changes_requested",
      },
      issue: {
        number: 42,
      },
    },
  };
  assert.equal(
    evaluateGuards(
      { match: { "review.state": "changes_requested", "issue.number": 42 } },
      ctx,
    ),
    true,
  );
  assert.equal(
    evaluateGuards({ match: { "review.state": "approved" } }, ctx),
    false,
  );
});

test("guards - returns true when no filters provided", () => {
  const ctx = {
    currentBranch: "main",
    payload: {},
  };
  assert.equal(evaluateGuards(undefined, ctx), true);
});
