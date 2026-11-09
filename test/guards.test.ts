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

test("guards - matches workflow name", () => {
  const ctx = {
    currentBranch: "main",
    payload: {
      workflow_run: {
        head_branch: "main",
        name: "CI",
      },
    },
  };
  assert.equal(evaluateGuards({ workflow: "CI" }, ctx), true);
  assert.equal(evaluateGuards({ workflow: "Release" }, ctx), false);
});

test("guards - matches senders list", () => {
  const ctx = {
    currentBranch: "main",
    payload: {
      sender: {
        login: "coderabbitai[bot]",
      },
    },
  };
  assert.equal(
    evaluateGuards({ senders: ["coderabbitai[bot]", "greptile[bot]"] }, ctx),
    true,
  );
  assert.equal(evaluateGuards({ senders: ["other-user"] }, ctx), false);
});

test("guards - returns true when no filters provided", () => {
  const ctx = {
    currentBranch: "main",
    payload: {},
  };
  assert.equal(evaluateGuards(undefined, ctx), true);
});
