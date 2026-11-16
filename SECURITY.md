# Security policy

## Supported versions

Security and correctness fixes are supported on the latest stable Jig release.

## Reporting a vulnerability

Report suspected vulnerabilities privately through GitHub's **Report a vulnerability** flow on the repository Security tab. Do not open a public issue before a fix is available.

Include:

- the Jig version and installation method;
- Linux distribution and CPU architecture;
- whether `systemd --user` is available;
- the affected command, HTTP boundary or repository operation;
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
- ordinary diagnostics and logs exclude Task title/note/reference content and credentials.

A report that Jig escapes these documented boundaries, exposes personal planning data unexpectedly, or modifies unrelated repository content is in scope.
