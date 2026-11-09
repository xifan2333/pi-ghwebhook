import { Type, type Static } from "typebox";

export const FilterSchema = Type.Object(
  {
    branch: Type.Optional(
      Type.String({ description: "Target branch name or '@current'" }),
    ),
    conclusion: Type.Optional(
      Type.String({
        description: "Conclusion filter (e.g. 'failure', 'success')",
      }),
    ),
    workflow: Type.Optional(
      Type.String({ description: "Workflow name filter (e.g. 'CI')" }),
    ),
    state: Type.Optional(
      Type.String({
        description:
          "Review or PR state filter (e.g. 'changes_requested', 'approved')",
      }),
    ),
    senders: Type.Optional(
      Type.Array(Type.String(), { description: "Allowed sender logins" }),
    ),
    isBot: Type.Optional(
      Type.Boolean({
        description: "Filter for bot (true) or human (false) senders",
      }),
    ),
    match: Type.Optional(
      Type.Record(
        Type.String(),
        Type.Union([Type.String(), Type.Number(), Type.Boolean()]),
        {
          description:
            "Arbitrary field matching on payload (dot-separated path)",
        },
      ),
    ),
  },
  { additionalProperties: false },
);

export type FilterConfig = Static<typeof FilterSchema>;

export const ActionSchema = Type.Object(
  {
    prompt: Type.String({
      description: "Template string to dispatch to agent",
    }),
    deliverAs: Type.Optional(
      Type.Union([Type.Literal("steer"), Type.Literal("followUp")], {
        description:
          "Delivery urgency: steer interrupts turn, followUp queues next",
      }),
    ),
  },
  { additionalProperties: false },
);

export type ActionConfig = Static<typeof ActionSchema>;

export const SubscriptionRuleSchema = Type.Object(
  {
    event: Type.Optional(
      Type.String({
        description:
          "Upstream GitHub Webhook event identifier (e.g. 'workflow_run.completed', 'push', 'issues.opened')",
      }),
    ),
    topic: Type.Optional(
      Type.String({
        description:
          "Alias for 'event' (e.g. 'workflow_run.completed' or 'github.workflow_run.completed')",
      }),
    ),
    filters: Type.Optional(FilterSchema),
    action: ActionSchema,
  },
  { additionalProperties: false },
);

export type SubscriptionRule = Static<typeof SubscriptionRuleSchema>;

export const ConfigSchema = Type.Object(
  {
    version: Type.Literal(1, { description: "Schema version" }),
    enabled: Type.Boolean({ default: true }),
    repo: Type.Optional(
      Type.String({
        default: "auto",
        description: "Target GitHub repo (owner/repo or 'auto')",
      }),
    ),
    secret: Type.Optional(
      Type.String({ description: "Optional Webhook HMAC secret" }),
    ),
    subscriptions: Type.Array(SubscriptionRuleSchema, {
      description: "List of declarative webhook event subscriptions",
    }),
  },
  { additionalProperties: false },
);

export type GhWebhookConfig = Static<typeof ConfigSchema>;
