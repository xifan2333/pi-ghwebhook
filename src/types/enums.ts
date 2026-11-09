/**
 * GitHub Webhook Event names as sent in the `X-GitHub-Event` HTTP header.
 */
export enum GitHubEvent {
  WorkflowRun = "workflow_run",
  PullRequestReview = "pull_request_review",
  PullRequestReviewComment = "pull_request_review_comment",
  CheckSuite = "check_suite",
  IssueComment = "issue_comment",
  Push = "push",
  PullRequest = "pull_request",
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

/**
 * Normalized topics dispatched over pi-ghwebhook EventBus.
 */
export enum EventTopic {
  WorkflowSuccess = "github.workflow_run.success",
  WorkflowFailure = "github.workflow_run.failure",
  WorkflowCancelled = "github.workflow_run.cancelled",
  WorkflowTimedOut = "github.workflow_run.timed_out",
  WorkflowSkipped = "github.workflow_run.skipped",
  WorkflowActionRequired = "github.workflow_run.action_required",

  CheckSuiteSuccess = "github.check_suite.success",
  CheckSuiteFailure = "github.check_suite.failure",

  ReviewBotSubmitted = "github.pull_request_review.bot",
  ReviewHumanSubmitted = "github.pull_request_review.human",
  ReviewChangesRequested = "github.pull_request_review.changes_requested",

  ReviewCommentCreated = "github.pull_request_review_comment.created",
  IssueCommentCreated = "github.issue_comment.created",
}
