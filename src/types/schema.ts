import { Type, type Static } from "typebox";

export const EventTriggerSchema = Type.Object(
  {
    types: Type.Optional(
      Type.Array(Type.String(), { description: "Event activity types" }),
    ),
    branches: Type.Optional(
      Type.Array(Type.String(), {
        description: "Branch filters, supports '@current' and globs",
      }),
    ),
    workflows: Type.Optional(
      Type.Array(Type.String(), { description: "Workflow names filter" }),
    ),
  },
  { additionalProperties: true },
);

export type EventTriggerConfig = Static<typeof EventTriggerSchema>;

export const JobSchema = Type.Object(
  {
    name: Type.Optional(Type.String({ description: "Optional job name" })),
    if: Type.Optional(
      Type.String({
        description: "Condition expression (e.g. \"conclusion == 'failure'\")",
      }),
    ),
    prompt: Type.String({ description: "Template string sent to Pi Agent" }),
    deliverAs: Type.Optional(
      Type.Union([Type.Literal("steer"), Type.Literal("followUp")], {
        description:
          "Delivery urgency: steer interrupts turn, followUp queues next",
        default: "followUp",
      }),
    ),
  },
  { additionalProperties: false },
);

export type JobConfig = Static<typeof JobSchema>;

export const WorkflowSchema = Type.Object(
  {
    $schema: Type.Optional(Type.String()),
    name: Type.Optional(Type.String({ description: "Workflow display name" })),
    repo: Type.Optional(
      Type.String({
        default: "auto",
        description: "Target GitHub repo (owner/repo or 'auto')",
      }),
    ),
    secret: Type.Optional(
      Type.String({ description: "Optional Webhook HMAC secret" }),
    ),
    on: Type.Union(
      [
        Type.String(),
        Type.Array(Type.String()),
        Type.Record(
          Type.String(),
          Type.Union([Type.Null(), EventTriggerSchema]),
        ),
      ],
      { description: "GitHub event triggers specification" },
    ),
    jobs: Type.Record(Type.String(), JobSchema, { description: "Jobs map" }),
  },
  { additionalProperties: false },
);

export type GhWebhookWorkflow = Static<typeof WorkflowSchema>;
