---
name: setup-ghwebhook
description: Set up and configure declarative GitHub Webhook automation (.pi/ghwebhook.json) for the current repository. Use when configuring CI/CD event-driven agent triggers, setting up webhook forwarders, or enabling automated CI-fix and PR-review loops in Pi.
---

# Setup GitHub Webhook Automation

Configure zero-polling, event-driven GitHub Webhook automation for the current repository. When events occur (such as CI failures or review submissions), `pi-ghwebhook` intercepts them via a local reverse tunnel and wakes up the agent via `pi.sendUserMessage()` to close the loop automatically.

## Work Loop

Follow these steps in sequence. Do not proceed to the next step until the current step satisfies its completion criterion.

### Step 1: Verify prerequisites and auto-heal

1. Check GitHub CLI installation and authentication:
   ```bash
   gh auth status
   ```
   If unauthenticated, instruct the human to log in with `gh auth login`.
2. Check if the official GitHub Webhook extension is installed:
   ```bash
   gh extension list
   ```
   If `cli/gh-webhook` (or `gh-webhook`) is missing, install it immediately:
   ```bash
   gh extension install cli/gh-webhook
   ```
3. Verify the current working directory is a Git repository with a GitHub remote:
   ```bash
   git remote get-url origin
   ```
   Ensure the remote URL points to a GitHub repository (`github.com`).

_Completion criterion_: `gh` is authenticated, `cli/gh-webhook` extension is verified installed, and the repository remote is confirmed on GitHub.

### Step 2: Sense repository context

Inspect the repository to tailor the subscription rules:

1. Discover GitHub Actions workflows under `.github/workflows/`:
   ```bash
   ls .github/workflows/*.yml .github/workflows/*.yaml 2>/dev/null || true
   ```
   Inspect workflow names (such as `CI`, `Build`, `Test`, `Release`). If an obvious main CI workflow exists, record its name for filtering.
2. Check for AI code review bot integrations:
   - Check if `.coderabbit.yaml` or `.coderabbit.yml` exists.
   - Check for Greptile, Copilot, or other review bot configurations.

_Completion criterion_: Identified primary CI workflow name (or determined to match all workflows) and identified whether review bot subscriptions are needed.

### Step 3: Scaffold `.pi/ghwebhook.json`

Write `.pi/ghwebhook.json` in the repository root. Tailor the subscription rules based on the findings from Step 2:

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
        "conclusion": "failure"
      },
      "action": {
        "deliverAs": "followUp",
        "prompt": "CI run failed on branch {{ branch }}.\n\nRun URL: {{ run_url }}\nCommit: {{ head_sha }}\n\nPlease run `gh run view {{ run_id }} --log-failed` to diagnose the error and prepare a fix."
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
        "isBot": true
      },
      "action": {
        "deliverAs": "steer",
        "prompt": "Received review comments from {{ sender }}:\n\nState: {{ review_state }}\nDetails:\n{{ review_body }}\n\nPlease evaluate these comments critically: triage true issues to fix, and refute false positives."
      }
    }
  ]
}
```

If specific workflows were identified in Step 2 (e.g. `CI`), add `"workflow": "CI"` under `filters` for the `workflow_run.completed` rules to avoid triggering on auxiliary workflows.

_Completion criterion_: `.pi/ghwebhook.json` exists in repository root, is valid JSON, and contains tailored subscriptions.

### Step 4: Verify and activate

1. If running inside an active interactive Pi session, instruct the user to reload the extension or reload runtime:
   ```text
   /reload
   ```
2. On session start, `pi-ghwebhook` automatically detects `.pi/ghwebhook.json`, binds an ephemeral local port on `127.0.0.1:0`, spawns `gh webhook forward --events=*`, and displays an info notification in TUI.

_Completion criterion_: Explained activation method to the user and confirmed configuration ready for incoming events.

---

## Reference

### Supported Filter Keys

- `branch`: Target branch name or `@current` (dynamically matches the active Git branch).
- `conclusion`: Workflow conclusion (`success`, `failure`, `cancelled`, `timed_out`, `skipped`, etc.).
- `workflow`: Workflow name (e.g. `CI`).
- `state`: Review state (`approved`, `changes_requested`, `commented`) or PR state.
- `senders`: List of allowed sender logins (e.g. `["coderabbitai[bot]"]`).
- `isBot`: Boolean flag matching bot senders (`true`) or human senders (`false`).
- `match`: Key-value map matching nested payload properties via dot notation (e.g. `{"review.state": "changes_requested"}`).

### Template Interpolation Variables

- `{{ branch }}`: Current head branch.
- `{{ head_sha }}`: Commit SHA.
- `{{ commit_message }}`: Head commit message.
- `{{ repo }}`: Repository full name (`owner/repo`).
- `{{ repo_url }}`: Repository HTML URL.
- `{{ run_id }}`: Workflow run ID.
- `{{ run_url }}`: Workflow run HTML URL.
- `{{ workflow }}`: Workflow name.
- `{{ conclusion }}`: Workflow conclusion.
- `{{ pr_number }}`: Pull request number.
- `{{ pr_title }}`: Pull request title.
- `{{ pr_url }}`: Pull request HTML URL.
- `{{ review_state }}`: Review state (`approved`, `changes_requested`, `commented`).
- `{{ review_body }}`: Review body text.
- `{{ sender }}`: Actor username or bot login.
- `{{ action }}`: Raw event action string.
