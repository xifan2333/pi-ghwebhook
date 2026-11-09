<div align="center">

# pi-ghwebhook

**Universal GitHub Webhook event bus and wake-up driver for the Pi coding agent**

[![npm version](https://img.shields.io/npm/v/pi-ghwebhook?logo=npm&logoColor=white)](https://www.npmjs.com/package/pi-ghwebhook)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.19.0-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Pi Package](https://img.shields.io/badge/pi--package-extension-black)](https://github.com/earendil-works/pi)
[![GitHub License](https://img.shields.io/github/license/xifan2333/pi-ghwebhook?logo=github&logoColor=white)](LICENSE)

English | [中文](README_zh.md)

</div>

## Overview

pi-ghwebhook eliminates manual polling and terminal switching after pushing code or creating pull requests. By hosting an in-process loopback server connected to GitHub CLI's `gh webhook forward` reverse tunnel, it receives real-time GitHub Webhook events, evaluates declarative filters, and wakes up the Pi Agent via `pi.sendUserMessage()` to close the loop.

## Key Architecture

- Upstream wire protocol: directly matches GitHub Webhook events (`<event>` or `<event>.<action>`). Supports all 100+ GitHub Webhook events.
- Declarative filters: condition evaluation (`branch`, `conclusion`, `workflow`, `state`, `senders`, `isBot`, `match`) is offloaded to configuration rules rather than rigid code branches.
- Zero public exposure: uses `gh webhook forward --events=*` local reverse tunnels. No public server, ngrok, or exposed port required.
- Dynamic port allocation: binds to `127.0.0.1:0`. The OS kernel dynamically assigns an unused port, eliminating port contention across concurrent sessions.
- Table-driven dispatch: O(1) hash map routing with strict complexity constraints (CCN <= 15, CogC <= 15).
- Workspace detection: probes `.pi/ghwebhook.json` on `session_start`. If absent, sleeps silently with zero resource consumption.
- Clean teardown: hooks into `session_shutdown` and process exit to terminate child processes and servers idempotently.

## Installation

Install into your Pi coding agent:

```bash
pi install npm:pi-ghwebhook
```

Or install from GitHub:

```bash
pi install git:github.com/xifan2333/pi-ghwebhook
```

To test locally in an active session:

```bash
pi -e /path/to/pi-ghwebhook
```

## Configuration (`.pi/ghwebhook.json`)

Place `.pi/ghwebhook.json` (or `.agents/ghwebhook.json`) in the root of any repository:

```json
{
  "version": 1,
  "enabled": true,
  "repo": "auto",
  "subscriptions": [
    {
      "event": "workflow_run.completed",
      "filters": {
        "branch": "@current",
        "workflow": "CI",
        "conclusion": "failure"
      },
      "action": {
        "deliverAs": "followUp",
        "prompt": "CI run failed on branch {{ branch }}.\n\nRun URL: {{ run_url }}\nCommit: {{ head_sha }}\n\nPlease inspect the failed run logs and propose a fix."
      }
    },
    {
      "event": "workflow_run.completed",
      "filters": {
        "branch": "@current",
        "conclusion": "success"
      },
      "action": {
        "deliverAs": "followUp",
        "prompt": "Remote CI has passed on branch {{ branch }}.\n\nRun URL: {{ run_url }}\n\nPlease check PR status and verify if it is ready to merge."
      }
    },
    {
      "event": "pull_request_review.submitted",
      "filters": {
        "branch": "@current",
        "isBot": true,
        "senders": ["coderabbitai[bot]", "greptile[bot]"]
      },
      "action": {
        "deliverAs": "steer",
        "prompt": "Received review feedback from {{ sender }}:\n\nState: {{ review_state }}\nDetails:\n{{ review_body }}\n\nPlease evaluate these comments critically: fix genuine issues and refute false positives."
      }
    },
    {
      "event": "issues.opened",
      "action": {
        "prompt": "New issue opened #{{ issue_number }}: {{ issue_title }}\n\n{{ issue_body }}"
      }
    },
    {
      "event": "push",
      "filters": {
        "branch": "main"
      },
      "action": {
        "prompt": "New commit pushed to main: {{ head_sha }} - {{ commit_message }}"
      }
    }
  ]
}
```

### Configuration Fields

| Field           | Type      | Default     | Description                                                                                              |
| --------------- | --------- | ----------- | -------------------------------------------------------------------------------------------------------- |
| `version`       | `1`       | `1`         | Schema version (must be 1).                                                                              |
| `enabled`       | `boolean` | `true`      | Enable or disable the extension for this workspace.                                                      |
| `repo`          | `string`  | `"auto"`    | Target GitHub repository (`owner/repo`). Resolved from `git remote get-url origin` when set to `"auto"`. |
| `secret`        | `string`  | `undefined` | Optional webhook HMAC SHA-256 secret.                                                                    |
| `subscriptions` | `Array`   | `[]`        | List of event subscription rules.                                                                        |

### Subscription Rule Fields

- `event`: Upstream GitHub Webhook event identifier (e.g., `workflow_run.completed`, `pull_request.opened`, `push`, `issues.labeled`).
- `topic`: Optional alias for `event`.
- `filters`: Declarative matching criteria.
- `action`: Action payload containing `prompt` and optional `deliverAs` (`"steer"` or `"followUp"`).

### Filters

- `branch`: Target branch name or `@current` (dynamically resolved to current working branch).
- `conclusion`: Workflow conclusion (`success`, `failure`, `cancelled`, `skipped`, etc.).
- `workflow`: Workflow name (e.g., `CI`).
- `state`: Review state (`approved`, `changes_requested`, `commented`) or PR state.
- `senders`: Array of allowed sender logins (e.g., `["coderabbitai[bot]"]`).
- `isBot`: Boolean flag matching Bot (`true`) or Human (`false`) senders.
- `match`: Key-value map for matching nested payload fields using dot notation (e.g., `{"review.state": "changes_requested"}`).

### Template Variables

- `{{ branch }}`: Branch name
- `{{ head_sha }}`: Commit SHA
- `{{ commit_message }}`: Head commit message
- `{{ repo }}` / `{{ repo_url }}`: Repository name and URL
- `{{ run_id }}` / `{{ run_url }}` / `{{ workflow }}` / `{{ conclusion }}`: Workflow run metadata
- `{{ pr_number }}` / `{{ pr_title }}` / `{{ pr_url }}`: Pull request details
- `{{ issue_number }}` / `{{ issue_title }}` / `{{ issue_url }}` / `{{ issue_body }}`: Issue details
- `{{ sender }}` / `{{ sender_type }}`: Triggering actor
- `{{ review_state }}` / `{{ review_body }}` / `{{ review_url }}`: Review details
- `{{ comment_body }}` / `{{ comment_url }}`: Comment details
- `{{ action }}`: Payload action string

## Development & Quality Gates

```bash
mise run check         # Run all quality gates (tsc, oxlint, prettier, lizard, jscpd, typos)
mise run check:plan    # Preview execution plan
mise run check:changed # Check only staged/modified files (< 50ms)
mise run fix           # Auto-format and fix lint/package issues
mise run test          # Run test suite
```

## License

[MIT](LICENSE) © 2026 xifan
