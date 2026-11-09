# pi-ghwebhook

Universal GitHub Webhook event bus and wake-up engine for the **Pi coding agent**.

Eliminates manual polling and terminal switching after creating PRs or waiting for CI. By hosting an in-process loopback server connected to GitHub CLI's `gh webhook forward` reverse tunnel, `pi-ghwebhook` receives real-time GitHub events, evaluates table-driven guard filters, and automatically wakes up the Pi Agent via `pi.sendUserMessage()` to close the loop.

---

## 🌟 Key Features

- **100% Upstream Aligned**: Direct 1-to-1 match with GitHub's wire protocol (`<event>` or `<event>.<action>`). Supports **all 100+ GitHub Webhook events** (e.g. `workflow_run.completed`, `pull_request.opened`, `issues.opened`, `push`, `release.published`).
- **Flexible Declarative Filters**: State & conclusion checks belong in `filters` (`conclusion`, `branch`, `isBot`, `senders`, `workflow`, `match`). No hardcoded pseudo-semantics in code.
- **Zero Polling & Zero Public IP**: Uses `gh webhook forward --events=*` local reverse tunnels. No public server, ngrok, or exposed ports needed.
- **Dynamic Port Allocation**: Binds to `127.0.0.1:0`. The OS kernel dynamically assigns free ports, ensuring zero port conflicts across concurrent terminal windows or multi-agent sessions.
- **Table-Driven Architecture**: $O(1)$ Hash Map routing (`Map<string, SubscriptionRule[]>`), zero cascading `if-else` spaghetti, strict cognitive & cyclomatic complexity gates (CCN $\le 15$, CogC $\le 15$).
- **Workspace-Aware & Zero Footprint**: Probes `.pi/ghwebhook.json` on `session_start`. If absent or disabled, it sleeps silently with 0% CPU and zero open ports.
- **Clean Lifecycle Teardown**: Hooks into `session_shutdown` and `process.on('exit')` to idempotently kill forwarder child processes and close HTTP servers. No orphan processes.

---

## 📦 Installation

Install into your Pi coding agent:

```bash
pi install npm:pi-ghwebhook
# or directly from GitHub:
pi install git:github.com/xifan2333/pi-ghwebhook
```

To test locally in an active session:

```bash
pi -e /path/to/pi-ghwebhook
```

---

## ⚙️ Configuration (`.pi/ghwebhook.json`)

Place `.pi/ghwebhook.json` (or `.agents/ghwebhook.json`) in the root of any repository where you want event-driven automation:

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
        "prompt": "⚠️ CI run failed on branch {{ branch }}!\n\n- Run: {{ run_url }}\n- Commit: {{ head_sha }}\n\nPlease run `gh run view {{ run_id }} --log-failed` to diagnose the error and prepare a fix."
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
        "prompt": "✅ Remote CI has completed successfully on branch {{ branch }}!\n\n- Run: {{ run_url }}\n\nPlease inspect PR checks status and check if it is ready to merge."
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
        "prompt": "🤖 Received review comments from Review Bot ({{ sender }}):\n\n- State: {{ review_state }}\n- Details:\n{{ review_body }}\n\nPlease evaluate these comments critically: triage true issues to fix, and refute false positives."
      }
    },
    {
      "event": "issues.opened",
      "action": {
        "prompt": "📌 New issue opened #{{ issue_number }}: {{ issue_title }}\n\n{{ issue_body }}"
      }
    },
    {
      "event": "push",
      "filters": {
        "branch": "main"
      },
      "action": {
        "prompt": "📦 New push to main: {{ head_sha }} - {{ commit_message }}"
      }
    }
  ]
}
```

### Configuration Fields

| Field           | Type      | Default     | Description                                                                           |
| --------------- | --------- | ----------- | ------------------------------------------------------------------------------------- |
| `version`       | `1`       | `1`         | Schema version (must be 1).                                                           |
| `enabled`       | `boolean` | `true`      | Toggle extension activation for this workspace.                                       |
| `repo`          | `string`  | `"auto"`    | GitHub `owner/repo`. When set to `"auto"`, resolved from `git remote get-url origin`. |
| `secret`        | `string`  | `undefined` | Optional webhook HMAC SHA-256 verification secret.                                    |
| `subscriptions` | `Array`   | `[]`        | List of event subscription rules.                                                     |

### Subscription Rule Fields

- `event`: Upstream GitHub Webhook event identifier (e.g. `workflow_run.completed`, `pull_request.opened`, `push`, `issues.labeled`).
- `topic`: Optional alias for `event`.
- `filters`: Declarative filter conditions.
- `action`: Dispatch instruction containing `prompt` and optional `deliverAs` (`"steer"` or `"followUp"`).

### Filters

- `branch`: Target branch name or special symbol `"@current"` (dynamically resolved to current working branch).
- `conclusion`: Workflow conclusion (`"success"`, `"failure"`, `"cancelled"`, `"skipped"`, etc.).
- `workflow`: Workflow name (e.g. `"CI"`).
- `state`: Review state (`"approved"`, `"changes_requested"`, `"commented"`) or PR state.
- `senders`: Array of allowed sender logins (e.g. `["coderabbitai[bot]"]`).
- `isBot`: Boolean flag to match Bot (`true`) or Human (`false`) senders.
- `match`: Arbitrary key-value map for matching nested payload properties using dot-notation (e.g. `{"review.state": "changes_requested"}`).

### Template Variables

Templates support `{{ variable }}` interpolation:

- `{{ branch }}`: Branch name
- `{{ head_sha }}`: Commit SHA
- `{{ commit_message }}`: Head commit message
- `{{ repo }}` / `{{ repo_url }}`: Repository name and HTML URL
- `{{ run_id }}` / `{{ run_url }}` / `{{ workflow }}` / `{{ conclusion }}`: Workflow run details
- `{{ pr_number }}` / `{{ pr_title }}` / `{{ pr_url }}`: PR details
- `{{ issue_number }}` / `{{ issue_title }}` / `{{ issue_url }}` / `{{ issue_body }}`: Issue details
- `{{ sender }}` / `{{ sender_type }}`: Triggering sender
- `{{ review_state }}` / `{{ review_body }}` / `{{ review_url }}`: Review details
- `{{ comment_body }}` / `{{ comment_url }}`: Comment details
- `{{ action }}`: Payload action string

---

## 🛠️ Development & Quality Gates

This project enforces strict quality standards via **mise** and **hk**:

```bash
mise run check         # Run all quality gates (tsc, oxlint, prettier, lizard, jscpd, typos)
mise run check:plan    # Preview execution plan
mise run check:changed # Check only staged/modified files (< 50ms)
mise run fix           # Auto-format and fix lint/package issues
mise run test          # Run test suite
```

### Quality Constraints

- **Lizard Cognitive & Cyclomatic Complexity**: CCN $\le 15$, CogC $\le 15$ per function.
- **JSCPD Duplication Gate**: Duplication threshold $\le 3.0\%$.
- **Strict TypeScript & Oxlint**: Zero warnings, zero diagnostic suppressions.

---

## 📄 License

[MIT](LICENSE) © 2026 xifan
