import type { Browser, BrowserContextOptions, Page } from "@playwright/test";
import type {
  Task,
  TaskCommand,
} from "../../src/core/task";
import type {
  CanonicalState,
  CommandResult,
} from "../../src/protocol";

export async function apiState(
  page: Page,
): Promise<CanonicalState> {
  return page.evaluate(async () => {
    const response = await fetch("/api/v1/tasks");
    if (!response.ok) {
      throw new Error(`GET /tasks failed: ${response.status}`);
    }
    return response.json() as Promise<CanonicalState>;
  });
}

export async function apiCommand(
  page: Page,
  command: TaskCommand,
): Promise<CommandResult> {
  return page.evaluate(async (canonicalCommand) => {
    const stateResponse = await fetch("/api/v1/tasks");
    if (!stateResponse.ok) {
      throw new Error(
        `GET /tasks failed: ${stateResponse.status}`,
      );
    }
    const state = (await stateResponse.json()) as CanonicalState;
    const token = (
      window as typeof window & {
        __JIG_WRITE_TOKEN__?: string;
      }
    ).__JIG_WRITE_TOKEN__;
    if (token === undefined) {
      throw new Error("Jig write token is unavailable");
    }

    const response = await fetch("/api/v1/commands", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-jig-write-token": token,
      },
      body: JSON.stringify({
        expected_revision: state.revision,
        command: canonicalCommand,
      }),
    });
    if (!response.ok) {
      throw new Error(
        `POST /commands failed: ${response.status} ${await response.text()}`,
      );
    }
    return response.json() as Promise<CommandResult>;
  }, command);
}

export async function resetCanonicalTasks(
  page: Page,
): Promise<void> {
  let state = await apiState(page);
  for (const task of state.tasks) {
    const result = await page.evaluate(
      async ({ taskId, expectedRevision }) => {
        const token = (
          window as typeof window & {
            __JIG_WRITE_TOKEN__?: string;
          }
        ).__JIG_WRITE_TOKEN__;
        if (token === undefined) {
          throw new Error("Jig write token is unavailable");
        }
        const response = await fetch("/api/v1/commands", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-jig-write-token": token,
          },
          body: JSON.stringify({
            expected_revision: expectedRevision,
            command: {
              type: "delete",
              task_id: taskId,
            },
          }),
        });
        if (!response.ok) {
          throw new Error(
            `Task reset failed: ${response.status} ${await response.text()}`,
          );
        }
        return response.json() as Promise<CommandResult>;
      },
      {
        taskId: task.id,
        expectedRevision: state.revision,
      },
    );
    state = await apiState(page);
  }
}

export async function browserCivilDate(
  page: Page,
  offsetDays = 0,
): Promise<string> {
  return page.evaluate((offset) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return [
      date.getFullYear().toString().padStart(4, "0"),
      (date.getMonth() + 1).toString().padStart(2, "0"),
      date.getDate().toString().padStart(2, "0"),
    ].join("-");
  }, offsetDays);
}

export async function taskByTitle(
  page: Page,
  title: string,
): Promise<Task> {
  const state = await apiState(page);
  const task = state.tasks.find(
    (candidate) => candidate.title === title,
  );
  if (task === undefined) {
    throw new Error(`Task not found: ${title}`);
  }
  return task;
}


export type BrowserAcceptanceProfile =
  | "expanded-fine"
  | "narrow-fine"
  | "narrow-coarse"
  | "expanded-reduced-motion"
  | "narrow-reduced-motion";

const BROWSER_ACCEPTANCE_PROFILES = {
  "expanded-fine": {
    viewport: { width: 1440, height: 900 },
    hasTouch: false,
  },
  "narrow-fine": {
    viewport: { width: 390, height: 844 },
    hasTouch: false,
  },
  "narrow-coarse": {
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  },
  "expanded-reduced-motion": {
    viewport: { width: 1440, height: 900 },
    hasTouch: false,
    reducedMotion: "reduce",
  },
  "narrow-reduced-motion": {
    viewport: { width: 390, height: 844 },
    hasTouch: false,
    reducedMotion: "reduce",
  },
} satisfies Record<BrowserAcceptanceProfile, BrowserContextOptions>;

export async function withBrowserAcceptanceProfile<T>(
  browser: Browser,
  profile: BrowserAcceptanceProfile,
  exercise: (page: Page) => Promise<T>,
): Promise<T> {
  const context = await browser.newContext(
    BROWSER_ACCEPTANCE_PROFILES[profile],
  );
  try {
    const page = await context.newPage();
    return await exercise(page);
  } finally {
    await context.close();
  }
}
