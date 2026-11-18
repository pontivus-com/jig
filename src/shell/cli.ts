import { rm } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import {
  loadConfig,
  loadConfigIfPresent,
  type JigConfig,
} from "./config";
import { main as serve } from "./main";

class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliError";
  }
}

interface CommandResult {
  readonly exit_code: number;
  readonly stdout: string;
  readonly stderr: string;
}

async function run(
  command: string,
  args: readonly string[],
): Promise<CommandResult> {
  const child = Bun.spawn({
    cmd: [command, ...args],
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return {
    exit_code: exitCode,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

const DEFAULT_HTTP_PORT = 47831;

function baseUrlForPort(port: number): string {
  return `http://127.0.0.1:${port}`;
}

function baseUrl(config: JigConfig): string {
  return baseUrlForPort(config.http_port);
}

async function jsonResponse(
  response: Response,
): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new CliError(
      `Jig service returned HTTP ${response.status} without JSON`,
    );
  }
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new CliError("Jig service returned an invalid response");
  }
  return value as Record<string, unknown>;
}

function isObjectRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function objectOrNull(value: unknown): Record<string, unknown> | null {
  return isObjectRecord(value) ? value : null;
}

function repositoryStatusLines(value: unknown): readonly string[] {
  const status = objectOrNull(value);
  const remote = objectOrNull(status?.remote);
  const localGit =
    typeof status?.local_git === "string" ? status.local_git : "unknown";
  const remoteGit =
    typeof remote?.state === "string" ? remote.state : "unknown";
  const lines = [
    `local_git: ${localGit}`,
    `remote_git: ${remoteGit}`,
  ];
  if (typeof remote?.remote_name === "string") {
    lines.push(`remote_name: ${remote.remote_name}`);
  }
  if (typeof remote?.remote_location === "string") {
    lines.push(`remote_repository: ${remote.remote_location}`);
  }
  return lines;
}

async function setupStatusIfReady(
  port: number,
): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(
      `${baseUrlForPort(port)}/api/v1/setup/status`,
      { signal: AbortSignal.timeout(250) },
    );
    if (!response.ok) {
      return null;
    }
    return jsonResponse(response);
  } catch {
    return null;
  }
}

async function statusIfReady(
  config: JigConfig,
): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(`${baseUrl(config)}/api/v1/status`, {
      signal: AbortSignal.timeout(250),
    });
    if (!response.ok) {
      return null;
    }
    return jsonResponse(response);
  } catch {
    return null;
  }
}

async function waitReady(
  port: number,
  timeoutMs = 2_000,
): Promise<Record<string, unknown>> {
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    const status = await setupStatusIfReady(port);
    if (status !== null) {
      return status;
    }
    await Bun.sleep(50);
  }
  throw new CliError(
    `Jig service did not become ready at ${baseUrlForPort(port)} within ${timeoutMs} ms`,
  );
}

async function systemdAvailable(): Promise<boolean> {
  if (Bun.which("systemctl") === null) {
    return false;
  }
  const result = await run("systemctl", [
    "--user",
    "show-environment",
  ]);
  return result.exit_code === 0;
}

async function startService(port: number): Promise<void> {
  if ((await setupStatusIfReady(port)) !== null) {
    return;
  }

  if (!(await systemdAvailable())) {
    throw new CliError(
      "The systemd user service manager is unavailable. Run 'jig serve' in a terminal as the foreground fallback.",
    );
  }

  const result = await run("systemctl", [
    "--user",
    "start",
    "jig.service",
  ]);
  if (result.exit_code !== 0) {
    throw new CliError(
      result.stderr || "Unable to start the Jig user service",
    );
  }
  await waitReady(port);
}

async function writeToken(config: JigConfig): Promise<string> {
  const response = await fetch(`${baseUrl(config)}/`);
  if (!response.ok) {
    throw new CliError(
      `Unable to read Jig application bootstrap: HTTP ${response.status}`,
    );
  }
  const html = await response.text();
  const match =
    /window\.__JIG_WRITE_TOKEN__=("[0-9a-f]{64}");/.exec(html);
  if (match?.[1] === undefined) {
    throw new CliError(
      "Jig application bootstrap did not contain the current write token",
    );
  }
  return JSON.parse(match[1]) as string;
}

async function postOperation(
  config: JigConfig,
  path: string,
  body: unknown,
): Promise<Record<string, unknown>> {
  const token = await writeToken(config);
  const response = await fetch(`${baseUrl(config)}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-jig-write-token": token,
    },
    body: JSON.stringify(body),
  });
  const payload = await jsonResponse(response);
  if (!response.ok) {
    throw new CliError(
      typeof payload.error === "string"
        ? payload.error
        : `Jig operation failed with HTTP ${response.status}`,
    );
  }
  return payload;
}

async function openBrowser(url: string): Promise<void> {
  const xdgOpen = Bun.which("xdg-open");
  if (xdgOpen !== null) {
    Bun.spawn({
      cmd: [xdgOpen, url],
      stdout: "ignore",
      stderr: "ignore",
      stdin: "ignore",
    });
    return;
  }

  const gio = Bun.which("gio");
  if (gio !== null) {
    Bun.spawn({
      cmd: [gio, "open", url],
      stdout: "ignore",
      stderr: "ignore",
      stdin: "ignore",
    });
    return;
  }

  process.stdout.write(
    `No desktop URL opener was found. Open ${url} in your browser.\n`,
  );
}

async function launch(): Promise<void> {
  const config = await loadConfigIfPresent();
  const port = config?.http_port ?? DEFAULT_HTTP_PORT;
  await startService(port);
  const url = baseUrlForPort(port);
  process.stdout.write(`${url}\n`);
  await openBrowser(url);
}

async function printStatus(): Promise<void> {
  const config = await loadConfigIfPresent();
  if (config === null) {
    const setup = await setupStatusIfReady(DEFAULT_HTTP_PORT);
    process.stdout.write(
      [
        setup === null ? "service: stopped or unavailable" : "service: ready",
        "setup: repository required",
        "repository: not configured",
        "",
      ].join("\n"),
    );
    return;
  }

  const status = await statusIfReady(config);
  if (status === null) {
    process.stdout.write(
      [
        "service: stopped or unavailable",
        `repository: ${config.repository_path}`,
        "local_git: unavailable while service is stopped",
        "remote_git: unavailable while service is stopped",
        "",
      ].join("\n"),
    );
    return;
  }

  process.stdout.write(
    [
      "service: ready",
      `repository: ${String(status.repository_path ?? config.repository_path)}`,
      ...repositoryStatusLines(status.repository_status),
      "",
    ].join("\n"),
  );
}

async function syncNow(): Promise<void> {
  const config = await loadConfig();
  await startService(config.http_port);
  const result = await postOperation(config, "/api/v1/sync", {});
  process.stdout.write(
    `${repositoryStatusLines(result.repository_status).join("\n")}\n`,
  );
}

async function doctor(): Promise<void> {
  const config = await loadConfigIfPresent();
  if (config === null) {
    const setup = await setupStatusIfReady(DEFAULT_HTTP_PORT);
    process.stdout.write(
      [
        `service_healthy: ${setup === null ? "false" : "true"}`,
        "repository_path: not configured",
        "setup_required: true",
        "",
      ].join("\n"),
    );
    return;
  }

  const status = await statusIfReady(config);
  if (status === null) {
    process.stdout.write(
      [
        "service_healthy: false",
        `repository_path: ${config.repository_path}`,
        "diagnostics: service is not running",
        "",
      ].join("\n"),
    );
    return;
  }

  const response = await fetch(
    `${baseUrl(config)}/api/v1/diagnostics`,
  );
  if (!response.ok) {
    throw new CliError(
      `Diagnostics request failed with HTTP ${response.status}`,
    );
  }
  const diagnostics = await jsonResponse(response);
  for (const [key, value] of Object.entries(diagnostics)) {
    process.stdout.write(`${key}: ${String(value)}\n`);
  }
}

async function uninstall(): Promise<void> {
  const home = homedir();
  const appDir = resolve(home, ".local", "share", "jig");
  const launcher = resolve(home, ".local", "bin", "jig");
  const configDir = resolve(home, ".config", "jig");
  const unit = resolve(
    home,
    ".config",
    "systemd",
    "user",
    "jig.service",
  );

  if (await systemdAvailable()) {
    await run("systemctl", [
      "--user",
      "disable",
      "--now",
      "jig.service",
    ]);
  }

  await rm(unit, { force: true });
  if (await systemdAvailable()) {
    await run("systemctl", ["--user", "daemon-reload"]);
  }

  await rm(configDir, { recursive: true, force: true });
  await rm(launcher, { force: true });
  await rm(appDir, { recursive: true, force: true });

  process.stdout.write(
    "Jig application, launcher, service, and local configuration removed. Repository .jig planning data was preserved.\n",
  );
}

async function runCli(argv: readonly string[]): Promise<void> {
  const [command, ...rest] = argv;
  switch (command) {
    case undefined:
      await launch();
      return;
    case "status":
      if (rest.length !== 0) {
        throw new CliError("Usage: jig status");
      }
      await printStatus();
      return;
    case "sync":
      if (rest.length !== 0) {
        throw new CliError("Usage: jig sync");
      }
      await syncNow();
      return;
    case "doctor":
      if (rest.length !== 0) {
        throw new CliError("Usage: jig doctor");
      }
      await doctor();
      return;
    case "serve":
      if (rest.length !== 0) {
        throw new CliError("Usage: jig serve");
      }
      await serve();
      return;
    case "uninstall":
      if (rest.length !== 0) {
        throw new CliError("Usage: jig uninstall");
      }
      await uninstall();
      return;
    default:
      throw new CliError(
        "Usage: jig [status|sync|doctor|serve|uninstall]",
      );
  }
}

if (import.meta.main) {
  try {
    await runCli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(
      `jig: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
