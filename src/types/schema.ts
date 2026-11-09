import { Type, type Static } from "typebox";

export const FilterSchema = Type.Object(
  {
    branch: Type.Optional(
      Type.String({ description: "Target branch name or '@current'" }),
    ),
    workflow: Type.Optional(
      Type.String({ description: "Workflow name filter" }),
    ),
    senders: Type.Optional(
      Type.Array(Type.String(), { description: "Allowed sender logins" }),
    ),
    conclusion: Type.Optional(
      Type.String({ description: "Workflow conclusion filter" }),
    ),
    state: Type.Optional(Type.String({ description: "Review state filter" })),
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
    topic: Type.String({ description: "Standard EventTopic to listen for" }),
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
