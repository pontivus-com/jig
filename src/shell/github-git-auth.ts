import {
  chmod,
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface GitHubAskpassHelper {
  readonly path: string;
  readonly dispose: () => Promise<void>;
}

async function writeAskpassHelper(root: string): Promise<string> {
  const helper = join(root, "jig-github-askpass.sh");
  await writeFile(
    helper,
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      'case "${1:-}" in',
      '  "Username for \'https://github.com\':"|"Username for \'https://github.com/"*) printf "%s\\n" "x-access-token" ;;',
      '  "Password for \'https://x-access-token@github.com\':"|"Password for \'https://x-access-token@github.com/"*) printf "%s\\n" "${JIG_GITHUB_ACCESS_TOKEN:?}" ;;',
      '  *) exit 1 ;;',
      "esac",
      "",
    ].join("\n"),
    { encoding: "utf8", mode: 0o700 },
  );
  await chmod(helper, 0o700);
  return helper;
}

export async function createGitHubAskpassHelper(): Promise<GitHubAskpassHelper> {
  const root = await mkdtemp(join(tmpdir(), "jig-github-askpass-"));
  const path = await writeAskpassHelper(root);
  return {
    path,
    dispose: () => rm(root, { recursive: true, force: true }),
  };
}

export function githubGitEnvironment(
  helperPath: string,
  accessToken: string,
): Readonly<Record<string, string>> {
  if (helperPath.length === 0 || accessToken.length === 0) {
    throw new Error("Invalid GitHub Git authentication input");
  }
  return {
    GIT_ASKPASS: helperPath,
    GIT_TERMINAL_PROMPT: "0",
    JIG_GITHUB_ACCESS_TOKEN: accessToken,
  };
}
