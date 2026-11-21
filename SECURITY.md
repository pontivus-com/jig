# Security policy

## Supported versions

Security and correctness fixes are supported on the latest stable Jig release.

## Reporting a vulnerability

Report suspected vulnerabilities privately through GitHub's **Report a vulnerability** flow on the repository Security tab. Do not open a public issue before a fix is available.

Include:

- the Jig version, platform and installation/onboarding method;
- Linux distribution/CPU architecture and whether `systemd --user` is available, or Android device/model, Android version/API level and WebView version;
- the affected command, HTTP/native capability boundary, credential operation, notification path or repository operation;
- a minimal reproduction when possible.

Do not include personal Task content, repository credentials or other secrets unless they are strictly required to reproduce the issue.

## Security boundary

Jig is local-first software:

- the HTTP service binds to loopback only;
- state-changing HTTP operations require a process-local write token;
- SQLite is the immediate local authority;
- repository synchronization uses an isolated `jig-data` ref/worktree;
- Git is invoked with argv arrays rather than shell interpolation;
- Task references are data and are never executed by Jig;
- ordinary diagnostics and logs exclude Task title/note/reference content and credentials;
- Android canonical SQLite and its managed Git checkout stay in app-private storage; Jig does not request arbitrary external-storage access;
- Android GitHub user credentials are encrypted with the Android Keystore-backed AES-GCM key boundary, excluded from backup/device-transfer rules, and never stored in SQLite, portable Git records or remote URLs;
- Linux and Android use the same public GitHub App Device Flow registration directly with GitHub; Jig has no client secret, private App key, hosted token broker or redirect callback;
- Android native HTTP performs the narrow HTTPS transport required by Git/GitHub integration without disabling TLS validation, and provider credentials are injected only after the managed GitHub remote has been revalidated;
- Android reminder scheduling keeps only its non-portable Task-id/notification-id/fingerprint registry in app-private storage and never promotes notification delivery into canonical Task state.

A report that Jig escapes these documented boundaries, exposes personal planning data unexpectedly, or modifies unrelated repository content is in scope.
