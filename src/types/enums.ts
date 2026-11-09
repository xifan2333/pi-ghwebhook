/**
 * Standard GitHub Webhook Event names as sent in the `X-GitHub-Event` HTTP header.
 */
export enum GitHubEvent {
  WorkflowRun = "workflow_run",
  WorkflowJob = "workflow_job",
  PullRequest = "pull_request",
  PullRequestReview = "pull_request_review",
  PullRequestReviewComment = "pull_request_review_comment",
  CheckSuite = "check_suite",
  CheckRun = "check_run",
  IssueComment = "issue_comment",
  Issues = "issues",
  Push = "push",
  Release = "release",
}

/**
 * Standard conclusions for GitHub Actions workflow runs and check suites,
 * aligned with GitHub OpenAPI specification (@octokit/openapi-webhooks-types).
 */
export enum WorkflowConclusion {
  Success = "success",
  Failure = "failure",
  Cancelled = "cancelled",
  TimedOut = "timed_out",
  Neutral = "neutral",
  ActionRequired = "action_required",
  Skipped = "skipped",
  Stale = "stale",
  StartupFailure = "startup_failure",
}

/**
 * Review state for pull request reviews.
 */
export enum ReviewState {
  Approved = "approved",
  ChangesRequested = "changes_requested",
  Commented = "commented",
  Dismissed = "dismissed",
}
