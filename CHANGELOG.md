# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.1] - 2026-11-10

### Fixed

- **Clean Message Ingestion (`pi.sendMessage`)**: Switched from `pi.sendUserMessage()` to `pi.sendMessage()` with a registered `ghwebhook` custom message renderer (`⚡ [GitHub Webhook]`). Incoming webhook prompts now cleanly appear in the chat stream without hijacking or polluting the user's input box.
- **Multi-Window PID Mutual Exclusion**: Implemented Linux-standard PID file locking (`.pi/ghwebhook.pid`) with `process.kill(pid, 0)` liveness probing. Opening multiple Pi windows on the same project no longer causes `gh webhook forward` collisions — secondary windows automatically enter `standby` and can take over ownership via `/ghwk.start`.

## [0.4.0] - 2026-11-10

### Added

- **Automatic Reconnection & Exponential Backoff**: Managed `GhForwarder` automatically recovers from abnormal child process exits (network timeouts, socket drops, server disconnects) using exponential backoff (2s → 4s → ... max 30s).
- **Stale Webhook Self-Healing**: Automatically cleans up orphaned `https://webhook-forwarder.github.com/hook` GitHub webhooks if a previous run exited ungracefully and caused `Hook already exists on this repository` (HTTP 422).
- **Real-Time Branch Synchronization (Zero-Polling)**: Aligned with VS Code and Neovim gitsigns architectures to monitor `.git/HEAD` via OS kernel file notifications (`fs.watch`) and in-memory HEAD parsing, achieving sub-millisecond branch switch detection with zero CPU/process polling.
- **Real-Time TUI Status Synchronization**: Dynamic status transitions reflect `reconnecting` (`▲`), `running` (`●`), and `disconnected` (`×`) states in the TUI status bar and `/ghwk.status` output.
- **Table-Driven Architecture & Guard Clauses**: Eliminated deep nested `if` statements across the codebase with formalized `ControllerStatus` and `ForwarderState` enums, table-driven TUI/header status mappings, and functional early returns.

## [0.3.0] - 2026-11-09

### Added

- **Native TUI Status Bar**: Persistent status bar indicator showing active repo, branch, and connection state (`● ghwk: <repo> (<branch>)` / `○ ghwk: stopped`), inspired by `pi-exa`.
- **Controller Commands (`ghwk.*`)**: Dedicated commands for runtime control:
  - `/ghwk.status`: Display formatted status card with active triggers and jobs.
  - `/ghwk.start`: Manually start the receiver and GitHub tunnel.
  - `/ghwk.stop`: Manually pause the receiver and release local process/ports.
  - `/ghwk.restart`: Hot-restart and reload configuration from disk.
- **WebhookController Architecture**: Encapsulated state machine cleanly decoupling lifecycle, process management, and TUI presentation.

## [0.2.1] - 2026-11-09

### Added

- **HTTP Status Dashboard (GET)**: Added an HTTP GET health dashboard on the loopback server (`http://127.0.0.1:<port>/`), allowing developers to inspect active repo, branch, tunnel state, and event triggers directly in a web browser.
- **Configurable Port (`port`)**: Added optional `port` configuration to `.pi/ghwebhook.json` (defaults to 0 for automatic dynamic allocation).

## [0.2.0] - 2026-11-09

### Added

- **Built-in `setup-ghwebhook` Skill**: Packaged an interactive setup skill that auto-detects `gh` CLI credentials, auto-heals missing `cli/gh-webhook` extensions, senses repo workflow and review bot configs, and scaffolds tailored `.pi/ghwebhook.json` rules.

## [0.1.0] - 2026-11-09

### Added

- **Universal Upstream-Aligned Event Bus**: Direct 1-to-1 match with GitHub Webhook wire protocol (`<event>` / `<event>.<action>`), natively supporting all 100+ GitHub events (`workflow_run.completed`, `pull_request.opened`, `push`, `issues.opened`, etc.).
- **Composable Declarative Filters**: Replaced rigid synthetic code topics with flexible filters (`branch`, `conclusion`, `workflow`, `state`, `senders`, `isBot`, `match`), empowering users to configure any combination of conditions directly in `.pi/ghwebhook.json`.
- **Official Schema Alignment**: Full type alignment with official `@octokit/openapi-webhooks-types`.
- **In-Process Loopback Server**: Ephemeral port listener on `127.0.0.1:0` with optional HMAC SHA-256 webhook signature validation.
- **Full-Event Reverse Tunnel Forwarding**: Managed `gh webhook forward --events=*` subprocess with automatic teardown on `session_shutdown` and `process.exit`.
- **Template Renderer**: Safe, single-pass $O(N)$ string interpolation engine for prompt synthesis.
- **Workspace Probing**: Zero-footprint detection of `.pi/ghwebhook.json` and `.agents/ghwebhook.json`.
- **Tooling & Quality Gates**: Native `mise` and `hk` orchestration with `oxlint`, `tsc`, `prettier`, `lizard` complexity audit, and `jscpd` code duplication gate.
