import { rm, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { initializeRepositoryInstallation } from "../../src/shell/setup";
import { main } from "../../src/shell/main";
import { runGit } from "../../src/shell/git";

const root = resolve("/tmp", "jig-playwright-repository");
const remote = resolve("/tmp", "jig-playwright-remote.git");
const home = resolve("/tmp", "jig-playwright-home");
const configPath = resolve(home, ".config", "jig", "config.json");

async function gitAt(
  cwd: string,
  args: readonly string[],
): Promise<void> {
  const result = await runGit(cwd, args);
  if (result.exit_code !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
}

async function git(args: readonly string[]): Promise<void> {
  await gitAt(root, args);
}

await rm(root, { recursive: true, force: true });
await rm(remote, { recursive: true, force: true });
await rm(home, { recursive: true, force: true });
await mkdir(root, { recursive: true });
await mkdir(remote, { recursive: true });
await gitAt(remote, ["init", "--bare"]);
await git(["init"]);
await git(["config", "user.name", "Jig Browser Fixture"]);
await git(["config", "user.email", "browser-fixture@local.invalid"]);
await writeFile(resolve(root, "personal.txt"), "unrelated user content\n", "utf8");
await git(["add", "personal.txt"]);
await git(["commit", "-m", "fixture baseline"]);
await git(["remote", "add", "origin", remote]);

await initializeRepositoryInstallation({
  repository_path: root,
  http_port: 47832,
  config_path: configPath,
});

process.env.HOME = home;
await main();