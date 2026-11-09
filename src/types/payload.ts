import type { components } from "@octokit/openapi-webhooks-types";

export type WebhookSchemas = components["schemas"];

// Workflow Run
export type WorkflowRunCompletedPayload =
  WebhookSchemas["webhook-workflow-run-completed"];
export type WorkflowRunInProgressPayload =
  WebhookSchemas["webhook-workflow-run-in-progress"];
export type WorkflowRunRequestedPayload =
  WebhookSchemas["webhook-workflow-run-requested"];
export type WorkflowRunPayload =
  | WorkflowRunCompletedPayload
  | WorkflowRunInProgressPayload
  | WorkflowRunRequestedPayload;

// Pull Request Review
export type PullRequestReviewSubmittedPayload =
  WebhookSchemas["webhook-pull-request-review-submitted"];
export type PullRequestReviewEditedPayload =
  WebhookSchemas["webhook-pull-request-review-edited"];
export type PullRequestReviewDismissedPayload =
  WebhookSchemas["webhook-pull-request-review-dismissed"];
export type PullRequestReviewPayload =
  | PullRequestReviewSubmittedPayload
  | PullRequestReviewEditedPayload
  | PullRequestReviewDismissedPayload;

// Pull Request Review Comment
export type PullRequestReviewCommentCreatedPayload =
  WebhookSchemas["webhook-pull-request-review-comment-created"];
export type PullRequestReviewCommentEditedPayload =
  WebhookSchemas["webhook-pull-request-review-comment-edited"];
export type PullRequestReviewCommentDeletedPayload =
  WebhookSchemas["webhook-pull-request-review-comment-deleted"];
export type PullRequestReviewCommentPayload =
  | PullRequestReviewCommentCreatedPayload
  | PullRequestReviewCommentEditedPayload
  | PullRequestReviewCommentDeletedPayload;

// Check Suite
export type CheckSuiteCompletedPayload =
  WebhookSchemas["webhook-check-suite-completed"];
export type CheckSuiteRequestedPayload =
  WebhookSchemas["webhook-check-suite-requested"];
export type CheckSuiteRerequestedPayload =
  WebhookSchemas["webhook-check-suite-rerequested"];
export type CheckSuitePayload =
  | CheckSuiteCompletedPayload
  | CheckSuiteRequestedPayload
  | CheckSuiteRerequestedPayload;

// Issue Comment
export type IssueCommentCreatedPayload =
  WebhookSchemas["webhook-issue-comment-created"];
export type IssueCommentEditedPayload =
  WebhookSchemas["webhook-issue-comment-edited"];
export type IssueCommentDeletedPayload =
  WebhookSchemas["webhook-issue-comment-deleted"];
export type IssueCommentPayload =
  | IssueCommentCreatedPayload
  | IssueCommentEditedPayload
  | IssueCommentDeletedPayload;

export type SupportedWebhookPayload =
  | WorkflowRunPayload
  | PullRequestReviewPayload
  | PullRequestReviewCommentPayload
  | CheckSuitePayload
  | IssueCommentPayload;

/**
 * Fallback generic webhook payload structure for unknown or untyped events.
 */
export type WebhookPayload = Record<string, any>;
