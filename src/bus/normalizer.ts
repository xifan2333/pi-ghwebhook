import {
  GitHubEvent,
  WorkflowConclusion,
  EventTopic,
  ReviewState,
} from "../types/enums.js";
import type { WebhookPayload } from "../types/payload.js";

type TopicExtractor = (payload: WebhookPayload) => EventTopic | null;

const WORKFLOW_CONCLUSION_MAP: ReadonlyMap<string, EventTopic> = new Map([
  [WorkflowConclusion.Success, EventTopic.WorkflowSuccess],
  [WorkflowConclusion.Failure, EventTopic.WorkflowFailure],
  [WorkflowConclusion.Cancelled, EventTopic.WorkflowCancelled],
  [WorkflowConclusion.TimedOut, EventTopic.WorkflowTimedOut],
]);

const CHECK_SUITE_CONCLUSION_MAP: ReadonlyMap<string, EventTopic> = new Map([
  [WorkflowConclusion.Success, EventTopic.CheckSuiteSuccess],
  [WorkflowConclusion.Failure, EventTopic.CheckSuiteFailure],
]);

function extractWorkflowRunTopic(payload: WebhookPayload): EventTopic | null {
  if (payload.action !== "completed") return null;
  const conclusion = payload.workflow_run?.conclusion;
  return conclusion ? (WORKFLOW_CONCLUSION_MAP.get(conclusion) ?? null) : null;
}

function extractCheckSuiteTopic(payload: WebhookPayload): EventTopic | null {
  if (payload.action !== "completed") return null;
  const conclusion = payload.check_suite?.conclusion;
  return conclusion
    ? (CHECK_SUITE_CONCLUSION_MAP.get(conclusion) ?? null)
    : null;
}

function isBotSender(payload: WebhookPayload): boolean {
  const senderType = payload.review?.user?.type ?? payload.sender?.type;
  const login = payload.review?.user?.login ?? payload.sender?.login ?? "";
  return senderType === "Bot" || login.endsWith("[bot]");
}

function extractReviewTopic(payload: WebhookPayload): EventTopic | null {
  if (payload.action !== "submitted") return null;
  if (payload.review?.state === ReviewState.ChangesRequested) {
    return EventTopic.ReviewChangesRequested;
  }
  return isBotSender(payload)
    ? EventTopic.ReviewBotSubmitted
    : EventTopic.ReviewHumanSubmitted;
}

function extractReviewCommentTopic(payload: WebhookPayload): EventTopic | null {
  return payload.action === "created" ? EventTopic.ReviewCommentCreated : null;
}

function extractIssueCommentTopic(payload: WebhookPayload): EventTopic | null {
  return payload.action === "created" ? EventTopic.IssueCommentCreated : null;
}

const TOPIC_EXTRACTORS: ReadonlyMap<GitHubEvent, TopicExtractor> = new Map([
  [GitHubEvent.WorkflowRun, extractWorkflowRunTopic],
  [GitHubEvent.CheckSuite, extractCheckSuiteTopic],
  [GitHubEvent.PullRequestReview, extractReviewTopic],
  [GitHubEvent.PullRequestReviewComment, extractReviewCommentTopic],
  [GitHubEvent.IssueComment, extractIssueCommentTopic],
]);

export function normalizeEvent(
  event: string | GitHubEvent,
  payload: WebhookPayload,
): EventTopic | null {
  const extractor = TOPIC_EXTRACTORS.get(event as GitHubEvent);
  return extractor ? extractor(payload) : null;
}
