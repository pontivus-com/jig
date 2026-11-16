import {
  access,
  rm,
} from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import {
  loadConfig,
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

function baseUrl(config: JigConfig): string {
  return `http://127.0.0.1:${config.http_port}`;
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
  config: JigConfig,
  timeoutMs = 2_000,
): Promise<Record<string, unknown>> {
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    const status = await statusIfReady(config);
    if (status !== null) {
      return status;
    }
    await Bun.sleep(50);
  }
  throw new CliError(
    `Jig service did not become ready at ${baseUrl(config)} within ${timeoutMs} ms`,
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

async function startService(config: JigConfig): Promise<void> {
  if ((await statusIfReady(config)) !== null) {
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
  await waitReady(config);
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
  const config = await loadConfig();
  await startService(config);
  const url = baseUrl(config);
  process.stdout.write(`${url}\n`);
  await openBrowser(url);
}

async function printStatus(): Promise<void> {
  const config = await loadConfig();
  const status = await statusIfReady(config);
  if (status === null) {
    process.stdout.write(
      [
        "service: stopped or unavailable",
        `repository: ${config.repository_path}`,
        `remote: ${config.remote_name ?? "none"}`,
        "repository_status: unavailable while service is stopped",
        "",
      ].join("\n"),
    );
    return;
  }

  process.stdout.write(
    [
      "service: ready",
      `repository: ${String(status.repository_path ?? config.repository_path)}`,
      `remote: ${status.remote_configured === true ? "configured" : "none"}`,
      `repository_status: ${String(status.repository_status ?? "unknown")}`,
      "",
    ].join("\n"),
  );
}

async function syncNow(): Promise<void> {
  const config = await loadConfig();
  await startService(config);
  const result = await postOperation(config, "/api/v1/sync", {});
  process.stdout.write(
    `repository_status: ${String(result.repository_status ?? "unknown")}\n`,
  );
}

async function doctor(): Promise<void> {
  const config = await loadConfig();
  const status = await statusIfReady(config);
  if (status === null) {
    process.stdout.write(
      [
        "service_healthy: false",
        `repository_path: ${config.repository_path}`,
        `data_ref: ${config.data_ref}`,
        `remote_configured: ${config.remote_name !== null}`,
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

async function configure(argv: readonly string[]): Promise<void> {
  if (argv.length !== 2 || argv[0] !== "--repo") {
    throw new CliError(
      "Usage: jig configure --repo /absolute/path/to/repository",
    );
  }

  const config = await loadConfig();
  await startService(config);
  const result = await postOperation(config, "/api/v1/migrate", {
    repository_path: argv[1],
  });
  if (result.migrated !== true) {
    throw new CliError("Repository migration did not complete");
  }

  process.stdout.write(
    "Repository migration committed. Jig is restarting on the new data root.\n",
  );

  if (await systemdAvailable()) {
    const target = argv[1];
    const started = performance.now();
    while (performance.now() - started < 5_000) {
      try {
        const next = await loadConfig();
        const nextStatus = await statusIfReady(next);
        if (
          next.repository_path === target &&
          nextStatus?.repository_path === target
        ) {
          process.stdout.write(`repository: ${target}\n`);
          return;
        }
      } catch {
        // Expected while the service is intentionally restarting.
      }
      await Bun.sleep(100);
    }
    throw new CliError(
      "Migration succeeded but the restarted service did not become ready",
    );
  }

  process.stdout.write(
    "systemd --user is unavailable; restart the foreground service with 'jig serve'.\n",
  );
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

async function ensureInstalledUnitReadable(): Promise<void> {
  const unit = resolve(
    homedir(),
    ".config",
    "systemd",
    "user",
    "jig.service",
  );
  try {
    await access(unit);
  } catch {
    throw new CliError(
      "Jig systemd user unit is not installed; use 'jig serve' for the foreground fallback",
    );
  }
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
    case "configure":
      await configure(rest);
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
    case "service":
      if (rest.length !== 1 || rest[0] !== "check") {
        throw new CliError("Usage: jig service check");
      }
      await ensureInstalledUnitReadable();
      process.stdout.write("service_unit: installed\n");
      return;
    default:
      throw new CliError(
        "Usage: jig [status|sync|doctor|configure --repo PATH|serve|uninstall]",
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
