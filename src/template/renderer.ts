import type { WebhookPayload } from "../types/payload.js";

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function extractRepoVars(
  payload: WebhookPayload,
  vars: Record<string, string>,
): void {
  if (payload.repository?.full_name) {
    vars.repo = String(payload.repository.full_name);
    vars.repo_url = String(payload.repository.html_url ?? "");
  }
}

function extractBranchVars(
  payload: WebhookPayload,
  vars: Record<string, string>,
  fallbackBranch: string,
): void {
  const branch =
    payload.workflow_run?.head_branch ??
    payload.pull_request?.head?.ref ??
    payload.check_suite?.head_branch ??
    payload.workflow_job?.head_branch ??
    fallbackBranch;
  if (branch) vars.branch = String(branch);

  const headSha =
    payload.workflow_run?.head_sha ??
    payload.pull_request?.head?.sha ??
    payload.check_suite?.head_sha ??
    payload.after ??
    payload.head_commit?.id;
  if (headSha) vars.head_sha = String(headSha);

  if (payload.head_commit?.message) {
    vars.commit_message = String(payload.head_commit.message);
  }
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
  if (pr.state) vars.pr_state = String(pr.state);
}

function extractIssueVars(
  payload: WebhookPayload,
  vars: Record<string, string>,
): void {
  const iss = payload.issue;
  if (!iss) return;
  if (iss.number != null) vars.issue_number = String(iss.number);
  if (iss.title) vars.issue_title = String(iss.title);
  if (iss.html_url) vars.issue_url = String(iss.html_url);
  if (iss.body != null) vars.issue_body = String(iss.body);
}

function extractReviewAndCommentVars(
  payload: WebhookPayload,
  vars: Record<string, string>,
): void {
  if (payload.review) {
    const rev = payload.review;
    if (rev.state) vars.review_state = String(rev.state);
    if (rev.body != null) vars.review_body = String(rev.body);
    if (rev.html_url) vars.review_url = String(rev.html_url);
  }

  if (payload.comment) {
    const c = payload.comment;
    if (c.body != null) vars.comment_body = String(c.body);
    if (c.html_url) vars.comment_url = String(c.html_url);
  }
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

  if (payload.action) {
    vars.action = String(payload.action);
  }

  extractRepoVars(payload, vars);
  extractBranchVars(payload, vars, fallbackBranch);
  extractWorkflowVars(payload, vars);
  extractPullRequestVars(payload, vars);
  extractIssueVars(payload, vars);
  extractReviewAndCommentVars(payload, vars);
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
