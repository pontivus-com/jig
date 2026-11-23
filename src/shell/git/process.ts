export interface GitCommandResult {
  readonly exit_code: number;
  readonly stdout: string;
  readonly stderr: string;
}

export class GitAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitAdapterError";
  }
}

export async function runGit(
  cwd: string,
  args: readonly string[],
  input?: string,
  extraEnv: Readonly<Record<string, string>> = {},
  timeoutMs?: number,
): Promise<GitCommandResult> {
  const processHandle = Bun.spawn({
    cmd: ["git", ...args],
    cwd,
    stdin: input === undefined ? "ignore" : new Blob([input]),
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...extraEnv },
    detached: timeoutMs !== undefined,
  });

  let timedOut = false;
  const timeout =
    timeoutMs === undefined
      ? null
      : setTimeout(() => {
          timedOut = true;
          try {
            process.kill(-processHandle.pid, "SIGKILL");
          } catch {
            processHandle.kill("SIGKILL");
          }
        }, timeoutMs);

  try {
    const [exitCode, stdout, stderr] = await Promise.all([
      processHandle.exited,
      new Response(processHandle.stdout).text(),
      new Response(processHandle.stderr).text(),
    ]);
    return {
      exit_code: exitCode,
      stdout: stdout.trim(),
      stderr: timedOut ? "Git operation timed out" : stderr.trim(),
    };
  } finally {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
  }
}

export async function requireGit(
  cwd: string,
  args: readonly string[],
  input?: string,
  extraEnv: Readonly<Record<string, string>> = {},
): Promise<string> {
  const result = await runGit(cwd, args, input, extraEnv);
  if (result.exit_code !== 0) {
    throw new GitAdapterError(
      `git ${args[0] ?? "command"} failed: ${result.stderr || result.stdout}`,
    );
  }
  return result.stdout;
}
