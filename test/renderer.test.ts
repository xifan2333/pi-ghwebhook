import test from "node:test";
import assert from "node:assert/strict";
import { renderTemplate, extractVariables } from "../dist/template/renderer.js";

test("renderer - replaces variables accurately", () => {
  const template =
    "Branch: {{ branch }}, Status: {{ conclusion }}, Run: {{ run_url }}";
  const vars = {
    branch: "main",
    conclusion: "failure",
    run_url: "https://github.com/org/repo/actions/runs/123",
  };
  const rendered = renderTemplate(template, vars);
  assert.equal(
    rendered,
    "Branch: main, Status: failure, Run: https://github.com/org/repo/actions/runs/123",
  );
});

test("renderer - leaves unmapped placeholders untouched", () => {
  const template = "Hello {{ unknown_var }}";
  const rendered = renderTemplate(template, {});
  assert.equal(rendered, "Hello {{ unknown_var }}");
});

test("renderer - extractVariables from workflow_run payload", () => {
  const payload = {
    repository: { full_name: "xifan2333/pi-ghwebhook" },
    workflow_run: {
      id: 999,
      name: "CI",
      head_branch: "feat/test",
      head_sha: "abcdef123456",
      conclusion: "failure",
      html_url: "https://github.com/xifan2333/pi-ghwebhook/actions/runs/999",
    },
    sender: {
      login: "xifan",
      type: "User",
    },
  };
  const vars = extractVariables(payload);
  assert.equal(vars.repo, "xifan2333/pi-ghwebhook");
  assert.equal(vars.branch, "feat/test");
  assert.equal(vars.run_id, "999");
  assert.equal(vars.workflow, "CI");
  assert.equal(vars.conclusion, "failure");
  assert.equal(vars.sender, "xifan");
});
