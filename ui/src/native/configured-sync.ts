import type { JigSqlConnection } from "../../../src/persistence/sqlite";
import { createAndroidManagedGitHubCredentialProvider } from "./github-managed-transport";
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
    const effects = createAndroidGitEffects();
    const controller = createAndroidSyncController(
      database,
      effects,
      createAndroidManagedGitHubCredentialProvider(effects),
    );
    await controller.start();
    void controller.trigger().catch(() => undefined);
    return controller;
  })().catch((error: unknown) => {
    controllerPromise = null;
    throw error;
  });
  return controllerPromise;
}
