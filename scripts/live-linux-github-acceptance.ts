import { join } from "node:path";
import { pathToFileURL } from "node:url";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

const home = requiredEnv("HOME");
const appDir = join(home, ".local", "share", "jig");
const repo = requiredEnv("GITHUB_REPOSITORY");
const token = requiredEnv("GITHUB_TOKEN");
const issueNumber = requiredEnv("JIG_ACCEPTANCE_ISSUE");
const targetRepository = requiredEnv("JIG_ACCEPTANCE_TARGET").toLowerCase();

const transport = await import(
  pathToFileURL(join(appDir, "src", "shell", "github-transport.ts")).href
);
const auth = await import(
  pathToFileURL(join(appDir, "src", "github-auth.ts")).href
);
const registrationModule = await import(
  pathToFileURL(join(appDir, "src", "github-registration.ts")).href
);
const secretService = await import(
  pathToFileURL(join(appDir, "src", "shell", "secret-service.ts")).href
);

const issueApi =
  `https://api.github.com/repos/${repo}/issues/${issueNumber}/comments`;

async function createIssueComment(body: string): Promise<number> {
  const response = await fetch(issueApi, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28",
    },
    body: JSON.stringify({ body }),
  });
  if (!response.ok) {
    throw new Error(
      `Unable to create issue comment: HTTP ${response.status}`,
    );
  }
  const payload = await response.json() as { id?: unknown };
  if (typeof payload.id !== "number") {
    throw new Error("Issue comment response has no numeric id");
  }
  return payload.id;
}

async function updateIssueComment(
  commentId: number,
  body: string,
): Promise<void> {
  const response = await fetch(
    `https://api.github.com/repos/${repo}/issues/comments/${commentId}`,
    {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "content-type": "application/json",
        "x-github-api-version": "2022-11-28",
      },
      body: JSON.stringify({ body }),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Unable to update issue comment: HTTP ${response.status}`,
    );
  }
}

const deviceFlow = transport.createShellGitHubDeviceFlow();
const started = await deviceFlow.start();
const authorization = started.authorization;
if (authorization === null || authorization.mode !== "device") {
  throw new Error("Jig did not start GitHub Device Flow");
}

const page = await fetch(authorization.verification_uri, {
  redirect: "follow",
  headers: {
    "user-agent": "Jig live Linux acceptance",
  },
});
if (!page.ok || new URL(page.url).hostname !== "github.com") {
  throw new Error(
    `GitHub verification page was not reachable: HTTP ${page.status}`,
  );
}
const pageBody = await page.text();
if (pageBody.length < 1000) {
  throw new Error("GitHub verification page returned an unexpectedly small body");
}

const runUrl =
  `https://github.com/${repo}/actions/runs/${requiredEnv("GITHUB_RUN_ID")}`;
const commentId = await createIssueComment(
  [
    "### Live Linux Device Flow acceptance — authorization required",
    "",
    `Hosted run: ${runUrl}`,
    "",
    `Open **${authorization.verification_uri}** and enter code **${authorization.user_code}**.`,
    "",
    "This is the real Jig Desktop & Mobile Device Flow running from the real Linux installation with a real Secret Service session. The code is short-lived and will be redacted when the run settles.",
  ].join("\n"),
);

try {
  const settled = await deviceFlow.runUntilSettled((milliseconds: number) =>
    Bun.sleep(milliseconds)
  );
  const credential = deviceFlow.credential();
  if (credential === null || settled.error !== null) {
    throw new Error(
      settled.error ?? "GitHub Device Flow ended without a credential",
    );
  }

  const restoredSession = transport.createShellGitHubDeviceFlow();
  if (!(await restoredSession.restoreCredential())) {
    throw new Error("Secret Service did not restore the live GitHub credential");
  }
  const restoredCredential = restoredSession.credential();
  if (
    restoredCredential === null ||
    restoredCredential.user_id !== credential.user_id
  ) {
    throw new Error("Restored Secret Service credential does not match the authorized user");
  }

  const installations = await auth.listGitHubInstallations(
    credential.access_token,
  );
  const repositories: Array<{ id: number; owner: string; name: string }> = [];
  for (const installation of installations) {
    repositories.push(
      ...(await auth.listGitHubRepositories(
        credential.access_token,
        installation.id,
      )),
    );
  }

  const target = repositories.find(
    (repository) =>
      `${repository.owner}/${repository.name}`.toLowerCase() ===
      targetRepository,
  );
  if (target === undefined) {
    throw new Error(
      `Authorized Jig App installations do not expose required private acceptance repository ${targetRepository}`,
    );
  }

  if (credential.refresh_token === null) {
    throw new Error("Live Device Flow credential did not include a refresh token");
  }

  const refreshed = await auth.refreshGitHubCredential(
    registrationModule.GITHUB_APP_REGISTRATION,
    credential,
  );
  await secretService.storeGitHubCredential(refreshed);

  const persisted = await secretService.loadCurrentGitHubCredential();
  if (
    persisted === null ||
    persisted.user_id !== credential.user_id ||
    persisted.access_token !== refreshed.access_token
  ) {
    throw new Error("Refreshed credential was not persisted through Secret Service");
  }

  const refreshedInstallations = await auth.listGitHubInstallations(
    persisted.access_token,
  );
  if (refreshedInstallations.length === 0) {
    throw new Error("Refreshed credential cannot enumerate GitHub App installations");
  }

  await updateIssueComment(
    commentId,
    [
      "### Live Linux Device Flow acceptance — PASS",
      "",
      `Hosted run: ${runUrl}`,
      "",
      "- Real Jig Linux installation: **PASS**",
      "- Real GitHub verification page reachable: **PASS**",
      "- User-authorized Device Flow: **PASS** (authorization code redacted)",
      "- Real freedesktop Secret Service store + restore: **PASS**",
      `- Authorized private repository visible through Jig App installation: **PASS** (${targetRepository})`,
      "- Live refresh without client_secret + Secret Service persistence: **PASS**",
      "",
      "No production repository was cloned or mutated by this acceptance run.",
    ].join("\n"),
  );

  console.log(
    JSON.stringify(
      {
        result: "pass",
        user_id: credential.user_id,
        installation_count: installations.length,
        repository_count: repositories.length,
        target_repository: targetRepository,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  await updateIssueComment(
    commentId,
    [
      "### Live Linux Device Flow acceptance — FAILED",
      "",
      `Hosted run: ${runUrl}`,
      "",
      "The authorization code has been redacted.",
      "",
      `Failure: ${message}`,
    ].join("\n"),
  ).catch(() => undefined);
  throw error;
}
