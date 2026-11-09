export interface GitHubSender {
  login: string;
  type: string; // "User" | "Bot" | "Organization"
  id?: number;
}

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  head_sha: string;
  conclusion: string | null;
  status: string;
  html_url: string;
  run_attempt: number;
  run_number: number;
}

export interface GitHubRepository {
  name: string;
  full_name: string;
  html_url: string;
  default_branch?: string;
}

export interface GitHubPullRequestHead {
  ref: string;
  sha: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  head: GitHubPullRequestHead;
  html_url: string;
  state: string;
}

export interface GitHubReview {
  id: number;
  user: GitHubSender;
  body: string | null;
  state: string;
  html_url: string;
  submitted_at?: string;
}

export interface GitHubComment {
  id: number;
  user: GitHubSender;
  body: string;
  html_url: string;
  path?: string;
  line?: number;
}

export interface GitHubCheckSuite {
  id: number;
  head_branch: string;
  head_sha: string;
  conclusion: string | null;
  status: string;
}

export interface WorkflowRunPayload {
  action: string;
  workflow_run?: GitHubWorkflowRun;
  repository?: GitHubRepository;
  sender?: GitHubSender;
}

export interface PullRequestReviewPayload {
  action: string;
  review?: GitHubReview;
  pull_request?: GitHubPullRequest;
  repository?: GitHubRepository;
  sender?: GitHubSender;
}

export interface PullRequestReviewCommentPayload {
  action: string;
  comment?: GitHubComment;
  pull_request?: GitHubPullRequest;
  repository?: GitHubRepository;
  sender?: GitHubSender;
}

export interface CheckSuitePayload {
  action: string;
  check_suite?: GitHubCheckSuite;
  repository?: GitHubRepository;
  sender?: GitHubSender;
}

export interface IssueCommentPayload {
  action: string;
  issue?: {
    number: number;
    title: string;
    pull_request?: Record<string, unknown>;
  };
  comment?: GitHubComment;
  repository?: GitHubRepository;
  sender?: GitHubSender;
}

export type WebhookPayload = Record<string, any>;
