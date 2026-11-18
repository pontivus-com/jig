import type { JigSqlConnection } from "../../../src/persistence/sqlite";
import { currentAndroidGitHubToken } from "./github-credential";
import {
  createAndroidGitEffects,
} from "./git";
import {
  createAndroidSyncController,
  type AndroidSyncController,
} from "./sync";

let controllerPromise:
  Promise<AndroidSyncController> | null = null;

export function configuredNativeSynchronization(
  database: JigSqlConnection,
): Promise<AndroidSyncController> {
  controllerPromise ??= (async () => {
    const controller = createAndroidSyncController(
      database,
      createAndroidGitEffects(),
      currentAndroidGitHubToken,
    );
    await controller.start();
    void controller.trigger();
    return controller;
  })().catch((error: unknown) => {
    controllerPromise = null;
    throw error;
  });
  return controllerPromise;
}
