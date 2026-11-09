# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-09

### Added

- **Core Event Bus**: Table-driven hash-map dispatch (`Map<EventTopic, SubscriptionRule[]>`) with $O(1)$ routing.
- **Normalizer**: Pure table-driven GitHub event to `EventTopic` extractor with zero cascading `if-else` branches.
- **Structured Guards**: Pure function filter registry (`branch`, `workflow`, `senders`, `conclusion`, `state`) supporting dynamic `@current` branch matching.
- **In-Process Loopback Server**: Ephemeral port listener on `127.0.0.1:0` with optional HMAC SHA-256 webhook signature validation.
- **Child Process Forwarder**: Managed `gh webhook forward` subprocess integration with automatic lifecycle teardown on `session_shutdown` and `process.exit`.
- **Template Renderer**: Safe, single-pass $O(N)$ string interpolation engine for Prompt synthesis.
- **Workspace Probing**: Zero-footprint detection of `.pi/ghwebhook.json` and `.agents/ghwebhook.json`.
- **Tooling & Quality Gates**: Native `mise` and `hk` orchestration with `oxlint`, `tsc`, `prettier`, `lizard` complexity audit, and `jscpd` code duplication gate.
