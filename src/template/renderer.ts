import type { WebhookPayload } from "../types/payload.js";

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function extractRepoVars(
  payload: WebhookPayload,
  vars: Record<string, string>,
): void {
  const repo = payload.repository;
  if (!repo?.full_name) return;
  vars.repo = String(repo.full_name);
  vars.repo_url = String(repo.html_url ?? "");
}

function extractBranchVars(
  payload: WebhookPayload,
  fallbackBranch: string,
  vars: Record<string, string>,
): void {
  const branch =
    payload.workflow_run?.head_branch ??
    payload.pull_request?.head?.ref ??
    payload.check_suite?.head_branch ??
    fallbackBranch;
  if (branch) vars.branch = String(branch);

  const headSha =
    payload.workflow_run?.head_sha ??
    payload.pull_request?.head?.sha ??
    payload.check_suite?.head_sha ??
    payload.after;
  if (headSha) vars.head_sha = String(headSha);
}

function extractWorkflowVars(
  payload: WebhookPayload,
  vars: Record<string, string>,
): void {
  const wf = payload.workflow_run;
  if (!wf) return;
  if (wf.id != null) vars.run_id = String(wf.id);
  if (wf.html_url) vars.run_url = String(wf.html_url);
  if (wf.name) {
    vars.workflow = String(wf.name);
    vars.workflow_name = String(wf.name);
  }
  if (wf.conclusion) vars.conclusion = String(wf.conclusion);
  if (wf.run_number != null) vars.run_number = String(wf.run_number);
  if (wf.run_attempt != null) vars.run_attempt = String(wf.run_attempt);
}

function extractPullRequestVars(
  payload: WebhookPayload,
  vars: Record<string, string>,
): void {
  const pr = payload.pull_request;
  if (!pr) return;
  if (pr.number != null) vars.pr_number = String(pr.number);
  if (pr.title) vars.pr_title = String(pr.title);
  if (pr.html_url) vars.pr_url = String(pr.html_url);
}

function extractReviewVars(
  payload: WebhookPayload,
  vars: Record<string, string>,
): void {
  const rev = payload.review;
  if (!rev) return;
  if (rev.state) vars.review_state = String(rev.state);
  if (rev.body != null) vars.review_body = String(rev.body);
  if (rev.html_url) vars.review_url = String(rev.html_url);
}

function extractCommentVars(
  payload: WebhookPayload,
  vars: Record<string, string>,
): void {
  const c = payload.comment;
  if (!c) return;
  if (c.body != null) vars.comment_body = String(c.body);
  if (c.html_url) vars.comment_url = String(c.html_url);
}

function extractSenderVars(
  payload: WebhookPayload,
  vars: Record<string, string>,
): void {
  const senderLogin =
    payload.sender?.login ??
    payload.review?.user?.login ??
    payload.comment?.user?.login;
  if (senderLogin) vars.sender = String(senderLogin);

  const senderType =
    payload.sender?.type ??
    payload.review?.user?.type ??
    payload.comment?.user?.type;
  if (senderType) vars.sender_type = String(senderType);
}

export function extractVariables(
  payload: WebhookPayload,
  fallbackBranch = "",
): Record<string, string> {
  const vars: Record<string, string> = {};
  extractRepoVars(payload, vars);
  extractBranchVars(payload, fallbackBranch, vars);
  extractWorkflowVars(payload, vars);
  extractPullRequestVars(payload, vars);
  extractReviewVars(payload, vars);
  extractCommentVars(payload, vars);
  extractSenderVars(payload, vars);
  return vars;
}

export function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(VARIABLE_PATTERN, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match;
  });
}
