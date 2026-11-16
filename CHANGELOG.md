# Changelog

All notable Jig changes are recorded here. Release versions follow Semantic Versioning.

## [Unreleased]

### Added

- Initial Jig v1 MVP: Week, Day, History and Settings surfaces for lightweight date-based personal planning.
- Canonical Task model with title-first capture, optional priority, context, reference, notes and reminder time.
- Exact same-day and cross-day movement with pointer drag and non-drag keyboard alternatives.
- Derived carry-over for unfinished earlier work without silently changing its scheduled date.
- Completion, reopen, confirmed permanent deletion and completion history.
- Session-bounded in-app reminders with durable local suppression.
- System, Light and Dark presentation modes with responsive narrow-screen composition.
- Canonical Option A Jig identity with Ink/Amber/Paper palette, centralized Light/Dark Astryx theme, outlined logo lockups, app icon and favicon.
- Immediate local SQLite authority with revision-checked commands and crash-safe transactional mutation.
- Deterministic portable Task records synchronized through an isolated `jig-data` ref/worktree without touching unrelated repository content.
- Linux installer, `jig` launcher, `systemd --user` service, diagnostics, manual synchronization, repository migration and uninstall lifecycle.
- Security, installer, browser, repository and resource/readiness certification evidence for the v1 release candidate.
- Governed release tooling for immutable `vX.Y.Z` tags, GitHub Releases and certified Linux x64/arm64 release bundles.

### Security

- Loopback-only HTTP service with process-local write-token admission for state-changing requests.
- Safe Git argv invocation, repository/path containment, single-writer enforcement and non-executing Task references.
- Ordinary diagnostics/logging exclude credentials and personal Task title/note/reference content.

### Fixed

- Contained Week-row action hit areas so task actions remain independently pointer-addressable inside narrow date columns.
- Made single-writer lease publication atomic so concurrent service startup admits exactly one writable owner.

### Performance

- Certified maximum service RSS at 35,876 KiB against a 128 MiB limit.
- Certified five-minute idle one-core CPU average at 0.0167% against a 1.0% limit.
- Certified running-service launcher handoff p95/20 at 30 ms against a 500 ms limit.
- Certified stopped-service HTTP readiness p95/20 at 53 ms against a 2,000 ms limit.
