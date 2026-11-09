# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
