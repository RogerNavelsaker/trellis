# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `tl prime` — emits a compact agent-priming summary of active specs, plans, blocked plans with reasons, and recent handoffs. Supports `--full`, `--compact`, `--since`, `--status`, `--limit`, `--budget`, and `--json`.
- `tl list` — unified top-level view across specs, plans, and handoffs. Supports `--type`, `--status`, `--since`, `--plan`, `--limit`, and `--json`. `tl spec list` / `tl plan list` still work.

## [0.1.1] - 2026-03-27

### Fixed
- Removed the stray `version-json` command from the public CLI surface.
- Kept machine-readable version output on the supported `--version --json` path.
- Corrected the root help listing so it reflects the intended public commands.

## [0.1.0] - 2026-03-26

### Added
- Initial release of Trellis CLI.
- Git-native storage for specs, plans, and handoffs.
- Multi-agent safety with advisory file locks.
- Audit history for workflow transitions.
- Repo health checks with `tl doctor`.
- Stable JSON output for every command.
