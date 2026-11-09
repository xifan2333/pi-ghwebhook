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

pi-ghwebhook eliminates manual polling and terminal switching after pushing code or creating pull requests. By hosting an in-process loopback server connected to GitHub CLI's `gh webhook forward` reverse tunnel, it receives real-time GitHub Webhook events, evaluates GitHub Actions Workflow-style trigger rules, and wakes up the Pi Agent via `pi.sendUserMessage()` to close the loop.

## Key Architecture

- 100% GitHub Actions Workflow Specification: Uses official `on` and `jobs` syntax. Zero invented intermediate concepts.
- JSON Schema Autocompletion: Includes an official schema (`$schema`) for instant editor IntelliSense and validation.
- Zero Public Exposure: Uses `gh webhook forward --events=*` local reverse tunnels. No public server, ngrok, or exposed port required.
- Dynamic Port Allocation: Binds to `127.0.0.1:0`. The OS kernel dynamically assigns an unused port, eliminating port contention across concurrent sessions.
- Table-Driven Dispatch: O(1) event routing with strict complexity constraints (CCN <= 15, CogC <= 15).
- Workspace Detection: Probes `.pi/ghwebhook.json` on `session_start`. If absent, sleeps silently with zero resource consumption.
- Clean Teardown: Hooks into `session_shutdown` and process exit to terminate child processes and servers idempotently.

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

Place `.pi/ghwebhook.json` in the root of any repository. Point `$schema` to the hosted JSON Schema for auto-completion in VS Code, Cursor, and other editors:

```json
{
  "$schema": "https://raw.githubusercontent.com/xifan2333/pi-ghwebhook/main/schemas/ghwebhook.schema.json",
  "name": "CI & Review Automation",
  "on": {
    "workflow_run": {
      "workflows": ["CI"],
      "types": ["completed"],
      "branches": ["@current"]
    },
    "pull_request_review": {
      "types": ["submitted"],
      "branches": ["@current"]
    },
    "issues": {
      "types": ["opened"]
    },
    "push": {
      "branches": ["main"]
    }
  },
  "jobs": {
    "ci-failure": {
      "if": "github.event.workflow_run.conclusion == 'failure'",
      "prompt": "CI run failed on branch {{ branch }}.\n\nRun URL: {{ run_url }}\nCommit: {{ head_sha }}\n\nPlease run `gh run view {{ run_id }} --log-failed` to diagnose the error and prepare a fix.",
      "deliverAs": "followUp"
    },
    "ci-success": {
      "if": "github.event.workflow_run.conclusion == 'success'",
      "prompt": "Remote CI has passed on branch {{ branch }}.\n\nRun URL: {{ run_url }}\n\nPlease check PR checks status and verify if it is ready to merge.",
      "deliverAs": "followUp"
    },
    "review-bot": {
      "if": "github.event.review.user.type == 'Bot'",
      "prompt": "Received review comments from {{ sender }}:\n\nState: {{ review_state }}\nDetails:\n{{ review_body }}\n\nPlease evaluate these comments critically: triage true issues to fix, and refute false positives.",
      "deliverAs": "steer"
    },
    "new-issue": {
      "prompt": "New issue opened #{{ issue_number }}: {{ issue_title }}\n\n{{ issue_body }}"
    },
    "push-main": {
      "prompt": "New commit pushed to main: {{ head_sha }} - {{ commit_message }}"
    }
  }
}
```

### Configuration Fields

- `name`: Optional workflow name.
- `repo`: GitHub repository (`owner/repo`). Defaults to `"auto"` (resolved from `git remote get-url origin`).
- `secret`: Optional webhook HMAC SHA-256 verification secret.
- `on`: GitHub Actions event triggers specification:
  - `<event_name>`: Event name (e.g. `workflow_run`, `pull_request`, `push`, `issues`).
  - `types`: Activity types filtering `payload.action` (e.g. `["completed"]`, `["opened"]`).
  - `branches`: Branches filter supporting `@current` and globs (e.g. `["@current", "main", "feat/*"]`).
  - `workflows`: Workflow names filter (e.g. `["CI"]`).
- `jobs`: Map of jobs to execute:
  - `if`: Conditional expression (e.g. `github.event.workflow_run.conclusion == 'failure'`).
  - `prompt`: Prompt template sent to Pi Agent.
  - `deliverAs`: Pi message delivery mode: `"followUp"` (default) or `"steer"`.

### Template Variables

- `{{ branch }}`: Current head branch.
- `{{ head_sha }}`: Commit SHA.
- `{{ commit_message }}`: Head commit message.
- `{{ repo }}` / `{{ repo_url }}`: Repository name and URL.
- `{{ run_id }}` / `{{ run_url }}` / `{{ workflow }}` / `{{ conclusion }}`: Workflow run metadata.
- `{{ pr_number }}` / `{{ pr_title }}` / `{{ pr_url }}`: Pull request details.
- `{{ issue_number }}` / `{{ issue_title }}` / `{{ issue_url }}` / `{{ issue_body }}`: Issue details.
- `{{ sender }}` / `{{ sender_type }}`: Triggering actor.
- `{{ review_state }}` / `{{ review_body }}` / `{{ review_url }}`: Review details.
- `{{ comment_body }}` / `{{ comment_url }}`: Comment details.

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
