export enum GitHubEvent {
  WorkflowRun = "workflow_run",
  PullRequestReview = "pull_request_review",
  PullRequestReviewComment = "pull_request_review_comment",
  CheckSuite = "check_suite",
  IssueComment = "issue_comment",
  Push = "push",
  PullRequest = "pull_request",
}

export enum WorkflowConclusion {
  Success = "success",
  Failure = "failure",
  Cancelled = "cancelled",
  TimedOut = "timed_out",
  Neutral = "neutral",
  ActionRequired = "action_required",
}

export enum ReviewState {
  Approved = "approved",
  ChangesRequested = "changes_requested",
  Commented = "commented",
  Dismissed = "dismissed",
}

export enum ReviewAction {
  Submitted = "submitted",
  Edited = "edited",
  Dismissed = "dismissed",
}

export enum EventTopic {
  WorkflowSuccess = "github.workflow_run.success",
  WorkflowFailure = "github.workflow_run.failure",
  WorkflowCancelled = "github.workflow_run.cancelled",
  WorkflowTimedOut = "github.workflow_run.timed_out",

  CheckSuiteSuccess = "github.check_suite.success",
  CheckSuiteFailure = "github.check_suite.failure",

  ReviewBotSubmitted = "github.pull_request_review.bot",
  ReviewHumanSubmitted = "github.pull_request_review.human",
  ReviewChangesRequested = "github.pull_request_review.changes_requested",

  ReviewCommentCreated = "github.pull_request_review_comment.created",
  IssueCommentCreated = "github.issue_comment.created",
}
