import {
  AlertDialog,
  AppShell,
  Banner,
  Button,
  Icon,
  IconButton,
  LayerProvider,
} from "@astryxdesign/core";
import { Theme } from "@astryxdesign/core/theme";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { Task, TaskCommand } from "../../src/core/task";
import {
  addCivilDays,
  defaultAddDate,
  startOfWeekMonday,
  weekDates,
} from "../../src/core/planning";
import type {
  CanonicalState,
  CommandResult,
  Diagnostics,
  ServiceStatus,
} from "../../src/protocol";
import {
  draftFor,
  type TaskDraft,
} from "./task-editor";
import { HistoryView } from "./history";
import { isStaleRevision } from "./http";
import {
  readCanonicalTasks,
  readDiagnostics,
  readStatus,
  submitTaskCommand,
  triggerSync,
} from "./runtime";
import { Planner } from "./planner";
import {
  PlannerHeader,
  type Destination,
} from "./planner-header";
import { ReminderMonitor, useReminderClock } from "./reminder";
import { repositoryStatusPresentation } from "./repository-status";
import { SettingsView } from "./settings";
import {
  readAppearanceMode,
  readThemePreset,
  themeFor,
  writeAppearanceMode,
  writeThemePreset,
  type AppearanceMode,
  type ThemePreset,
} from "./appearance";
import {
  formatPlannerWeekRange,
  millisecondsUntilNextLocalDay,
  todayCivilDate,
} from "./dates";
import {
  TaskWorkspaceBottomSheet,
  TaskWorkspaceDrawer,
  type TaskWorkspacePresentation,
  type TaskWorkspaceState,
} from "./task-workspace";
import { useLayoutMode } from "./use-layout-mode";
import { SetupView } from "./setup";
import { JigLogo } from "./jig-logo";
import { installNativeActiveListener } from "./native/app-lifecycle";
import {
  readGitHubCapabilityStatus,
  readGitHubReconnectState,
  readSetupStatus,
  reconnectGitHub as reconnectGitHubIntent,
  resumeGitHubReconnect,
  type GitHubReconnectSnapshot,
  type SetupStatus,
} from "./setup-http";
interface PlannerState {
  readonly displayedWeekStart: string;
}

function initialPlannerState(): PlannerState {
  const today = todayCivilDate();
  return {
    displayedWeekStart: startOfWeekMonday(today),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface ApplicationShellProps {
  readonly topNav: ReactNode;
  readonly banner?: ReactNode;
  readonly children: ReactNode;
}

function ApplicationShell({
  topNav,
  banner,
  children,
}: ApplicationShellProps): React.ReactElement {
  return (
    <AppShell
      className="jig-app-shell"
      topNav={topNav}
      mobileNav={false}
      banner={banner}
      contentPadding={0}
      height="fill"
      variant="section"
    >
      {children}
    </AppShell>
  );
}

function OnboardingHeader(): React.ReactElement {
  return (
    <header className="jig-app-header jig-app-header-onboarding">
      <span className="jig-header-brand">
        <span className="jig-brand-logo-wrap" aria-hidden="true">
          <JigLogo />
        </span>
      </span>
    </header>
  );
}

function workspaceTaskId(state: TaskWorkspaceState): string | null {
  return state.mode === "task" ? state.taskId : null;
}

interface ConfiguredAppProps {
  readonly themePreset: ThemePreset;
  readonly appearanceMode: AppearanceMode;
  readonly onThemePresetChange: (value: ThemePreset) => void;
  readonly onAppearanceModeChange: (value: AppearanceMode) => void;
}

function ConfiguredApp({
  themePreset,
  appearanceMode,
  onThemePresetChange,
  onAppearanceModeChange,
}: ConfiguredAppProps): React.ReactElement {
  const layoutMode = useLayoutMode();
  const reminderNow = useReminderClock();
  const [destination, setDestination] = useState<Destination>("planner");
  const [plannerState, setPlannerState] =
    useState<PlannerState>(initialPlannerState);
  const [observedToday, setObservedToday] = useState(todayCivilDate);
  const [canonical, setCanonical] = useState<CanonicalState | null>(null);
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [githubReconnectAvailable, setGitHubReconnectAvailable] =
    useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [isOperating, setIsOperating] = useState(false);
  const [githubReconnect, setGitHubReconnect] =
    useState<GitHubReconnectSnapshot | null>(null);
  const [workspace, setWorkspace] = useState<TaskWorkspaceState>({
    mode: "closed",
  });
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);

  const tasks = canonical?.tasks ?? [];
  const selectedTaskId = workspaceTaskId(workspace);
  const selectedTask =
    selectedTaskId === null
      ? null
      : tasks.find((task) => task.id === selectedTaskId) ?? null;
  const selectedRecurrenceSeries =
    selectedTask?.recurrence_series_id === null ||
    selectedTask?.recurrence_series_id === undefined
      ? null
      : canonical?.recurrences.find(
          (series) =>
            series.id === selectedTask.recurrence_series_id,
        ) ?? null;
  const deleteTask =
    deleteTaskId === null
      ? null
      : tasks.find((task) => task.id === deleteTaskId) ?? null;
  const displayedDates = weekDates(plannerState.displayedWeekStart);

  const refreshCanonical = useCallback(async (): Promise<void> => {
    const next = await readCanonicalTasks();
    setCanonical(next);
  }, []);

  const refreshOperationalState = useCallback(
    async (): Promise<void> => {
      const [
        nextStatus,
        nextDiagnostics,
        githubCapabilities,
      ] = await Promise.all([
        readStatus(),
        readDiagnostics(),
        readGitHubCapabilityStatus(),
      ]);
      setStatus(nextStatus);
      setDiagnostics(nextDiagnostics);
      setGitHubReconnectAvailable(
        githubCapabilities.reconnect_available,
      );
    },
    [],
  );

  const load = useCallback(async (): Promise<void> => {
    setLoadError(null);
    try {
      await Promise.all([
        refreshCanonical(),
        refreshOperationalState(),
      ]);
    } catch (error) {
      setLoadError(errorMessage(error));
    }
  }, [refreshCanonical, refreshOperationalState]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void readStatus()
        .then(setStatus)
        .catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => {
    const onOnline = (): void => {
      void triggerSync()
        .then((repositoryStatus) => {
          setStatus((current) =>
            current === null
              ? current
              : {
                  ...current,
                  repository_status: repositoryStatus,
                },
          );
        })
        .catch(() => undefined);
    };
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
    };
  }, []);


  useEffect(() => {
    let disposed = false;
    let cleanup: (() => Promise<void>) | null = null;

    void installNativeActiveListener(() => {
      void Promise.all([
        resumeGitHubReconnect(),
        refreshCanonical(),
        triggerSync().then((next) => {
          if (!disposed) {
            setStatus((current) =>
              current === null
                ? current
                : {
                    ...current,
                    repository_status: next,
                  },
            );
          }
        }),
      ]).catch((error: unknown) => {
        if (!disposed) {
          setOperationError(
            `Jig could not refresh after Android resumed: ${errorMessage(error)}. Reload the application.`,
          );
        }
      });
    }).then((remove) => {
      if (disposed) {
        void remove();
        return;
      }
      cleanup = remove;
    });

    return () => {
      disposed = true;
      if (cleanup !== null) {
        void cleanup();
      }
    };
  }, [refreshCanonical]);

  useEffect(() => {
    let cancelled = false;
    let boundaryTimer: number | null = null;

    const checkLocalDay = async (): Promise<boolean> => {
      const nextToday = todayCivilDate();
      if (nextToday === observedToday) {
        return false;
      }

      const previousCurrentWeek = startOfWeekMonday(observedToday);
      const nextCurrentWeek = startOfWeekMonday(nextToday);
      setPlannerState((current) =>
        current.displayedWeekStart === previousCurrentWeek &&
        previousCurrentWeek !== nextCurrentWeek
          ? { displayedWeekStart: nextCurrentWeek }
          : current,
      );
      setObservedToday(nextToday);

      try {
        await refreshCanonical();
      } catch (error) {
        if (!cancelled) {
          setOperationError(
            `Jig could not refresh after the local day changed: ${errorMessage(error)}. Reload the application.`,
          );
        }
      }
      return true;
    };

    const scheduleBoundary = (): void => {
      boundaryTimer = window.setTimeout(() => {
        void checkLocalDay().then((changed) => {
          if (!cancelled && !changed) {
            scheduleBoundary();
          }
        });
      }, millisecondsUntilNextLocalDay() + 50);
    };

    const onFocus = (): void => {
      void checkLocalDay();
    };
    const onVisibility = (): void => {
      if (document.visibilityState === "visible") {
        void checkLocalDay();
      }
    };

    scheduleBoundary();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (boundaryTimer !== null) {
        window.clearTimeout(boundaryTimer);
      }
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [observedToday, refreshCanonical]);

  const runCommand = useCallback(
    async (command: TaskCommand): Promise<CommandResult | null> => {
      if (canonical === null || isOperating) {
        return null;
      }

      setOperationError(null);
      setIsOperating(true);
      try {
        const result = await submitTaskCommand(command, canonical.revision);
        try {
          await refreshCanonical();
        } catch (refreshError) {
          setOperationError(
            `Saved locally, but Jig could not refresh the view: ${errorMessage(refreshError)}. Reload the application.`,
          );
        }
        void readStatus().then(setStatus).catch(() => undefined);
        return result;
      } catch (error) {
        if (isStaleRevision(error)) {
          try {
            await refreshCanonical();
          } catch {
            // Keep the original concurrency failure visible.
          }
          setOperationError(
            "This view was out of date. Jig reloaded canonical Tasks; review your change and submit it again.",
          );
          return null;
        }

        setOperationError(errorMessage(error));
        return null;
      } finally {
        setIsOperating(false);
      }
    },
    [canonical, isOperating, refreshCanonical],
  );

  const toggleComplete = useCallback(
    async (task: Task): Promise<boolean> => {
      const changed =
        (await runCommand(
          task.completed_at === null
            ? { type: "complete", task_id: task.id }
            : { type: "reopen", task_id: task.id },
        )) !== null;
      if (changed) {
        setWorkspace((current) =>
          workspaceTaskId(current) === task.id
            ? { mode: "closed" }
            : current,
        );
      }
      return changed;
    },
    [runCommand],
  );

  const moveTaskExact = useCallback(
    async (
      taskId: string,
      destinationDate: string,
      destinationIndex: number,
    ): Promise<boolean> =>
      (await runCommand({
        type: "move",
        task_id: taskId,
        destination_date: destinationDate,
        destination_index: destinationIndex,
      })) !== null,
    [runCommand],
  );

  const setPriority = useCallback(
    async (task: Task, priority: Task["priority"]): Promise<boolean> =>
      (await runCommand({
        type: "edit",
        task_id: task.id,
        changes: { priority },
      })) !== null,
    [runCommand],
  );

  const selectTask = useCallback((task: Task): void => {
    setOperationError(null);
    setWorkspace({
      mode: "task",
      taskId: task.id,
      draft: draftFor(task, task.scheduled_date),
    });
  }, []);

  const openCreate = useCallback((date: string): void => {
    setOperationError(null);
    setWorkspace({
      mode: "create",
      originatingDate: date,
      draft: draftFor(null, date),
    });
  }, []);

  const saveWorkspace = useCallback(
    async (command: TaskCommand): Promise<boolean> => {
      const result = await runCommand(command);
      if (result === null || !("task" in result)) {
        return false;
      }
      setWorkspace({
        mode: "task",
        taskId: result.task.id,
        draft: draftFor(result.task, result.task.scheduled_date),
      });
      return true;
    },
    [runCommand],
  );

  const closeWorkspace = useCallback((): void => {
    setWorkspace({ mode: "closed" });
  }, []);

  const changeWorkspaceDraft = useCallback((draft: TaskDraft): void => {
    setWorkspace((current) =>
      current.mode === "task" || current.mode === "create"
        ? { ...current, draft }
        : current,
    );
  }, []);

  const navigateDestination = useCallback((next: Destination): void => {
    setDestination(next);
    setWorkspace({ mode: "closed" });
  }, []);

  const syncNow = useCallback(async (): Promise<void> => {
    if (isOperating) {
      return;
    }
    setIsOperating(true);
    setOperationError(null);
    try {
      await triggerSync();
      await refreshOperationalState();
    } catch (error) {
      setOperationError(errorMessage(error));
    } finally {
      setIsOperating(false);
    }
  }, [isOperating, refreshOperationalState]);

  const reconnectGitHub = useCallback(async (): Promise<void> => {
    if (isOperating) {
      return;
    }
    setIsOperating(true);
    setOperationError(null);
    try {
      const snapshot = await reconnectGitHubIntent();
      setGitHubReconnect(snapshot);
      if (snapshot.error !== null) {
        setOperationError(snapshot.error);
      }
    } catch (error) {
      setGitHubReconnect(null);
      setOperationError(errorMessage(error));
    } finally {
      setIsOperating(false);
    }
  }, [isOperating]);

  useEffect(() => {
    if (githubReconnect === null) {
      return;
    }

    let disposed = false;
    const observe = async (): Promise<void> => {
      try {
        const snapshot = await readGitHubReconnectState();
        if (disposed) {
          return;
        }
        if (snapshot.state === "initial") {
          setGitHubReconnect(null);
          await refreshOperationalState();
          return;
        }
        setGitHubReconnect(snapshot);
        if (snapshot.state === "attention" && snapshot.error !== null) {
          setOperationError(snapshot.error);
        }
      } catch {
        // The next observation or ordinary status refresh will retry.
      }
    };

    void observe();
    const interval = window.setInterval(() => {
      void observe();
    }, 1_000);

    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [githubReconnect !== null, refreshOperationalState]);

  const previousWeek = useCallback((): void => {
    setPlannerState((current) => ({
      displayedWeekStart: addCivilDays(current.displayedWeekStart, -7),
    }));
  }, []);

  const nextWeek = useCallback((): void => {
    setPlannerState((current) => ({
      displayedWeekStart: addCivilDays(current.displayedWeekStart, 7),
    }));
  }, []);

  const goToToday = useCallback((): void => {
    setPlannerState({
      displayedWeekStart: startOfWeekMonday(todayCivilDate()),
    });
  }, []);

  const repositoryStatus = repositoryStatusPresentation(status);
  const statusClassName =
    `jig-status-control jig-status-${repositoryStatus.key}`;
  const statusIcon = (
    <Icon
      icon={repositoryStatus.icon}
      color={repositoryStatus.iconColor}
    />
  );
  const statusControl = (
    <Button
      label={repositoryStatus.label}
      variant="ghost"
      size="sm"
      icon={statusIcon}
      onClick={() => navigateDestination("settings")}
      className={statusClassName}
    />
  );
  const compactStatusControl = (
    <IconButton
      label={repositoryStatus.label}
      variant="ghost"
      size="sm"
      icon={statusIcon}
      onClick={() => navigateDestination("settings")}
      className={statusClassName}
    />
  );

  const durableBanner =
    operationError !== null && workspace.mode === "closed" ? (
    <Banner
      status="error"
      title="Jig could not complete the operation"
      description={operationError}
      container="section"
      collapsible={false}
    />
  ) : repositoryStatus.key === "sync-issue" ? (
    <Banner
      status="warning"
      title={
        repositoryStatus.label === "Git issue"
          ? "Local Git issue"
          : "Repository synchronization issue"
      }
      description={repositoryStatus.message}
      container="section"
      collapsible={false}
      endContent={
        <Button
          label="Retry"
          variant="secondary"
          size="sm"
          onClick={() => {
            void syncNow();
          }}
        />
      }
    />
  ) : null;

  const workspacePresentation: TaskWorkspacePresentation | null =
    workspace.mode === "closed"
      ? null
      : workspace.mode === "create"
        ? {
            mode: "create",
            originatingDate: workspace.originatingDate,
            draft: workspace.draft,
          }
        : selectedTask === null
          ? null
          : {
              mode: "task",
              task: selectedTask,
              draft: workspace.draft,
            };

  const dismissWorkspaceFromContent = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      if (workspace.mode === "closed") {
        return;
      }
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(".jig-task-card, .jig-history-task-row, .jig-task-menu")
      ) {
        return;
      }
      closeWorkspace();
    },
    [closeWorkspace, workspace.mode],
  );

  const content =
    canonical === null ? (
      <div className="jig-loading">
        <h1>Jig</h1>
        {loadError === null ? (
          <p>Loading local planning data…</p>
        ) : (
          <>
            <Banner
              status="error"
              title="Jig could not load local planning data"
              description={loadError}
              collapsible={false}
            />
            <Button
              label="Retry"
              variant="primary"
              onClick={() => {
                void load();
              }}
            />
          </>
        )}
      </div>
    ) : destination === "planner" ? (
      <Planner
        tasks={tasks}
        now={reminderNow}
        displayedDates={displayedDates}
        selectedTask={selectedTask}
        onSelectTask={selectTask}
        onAdd={openCreate}
        onEdit={selectTask}
        onToggleComplete={toggleComplete}
        onSetPriority={setPriority}
        onDelete={(task) => setDeleteTaskId(task.id)}
        onMove={moveTaskExact}
      />
    ) : destination === "history" ? (
      <HistoryView
        tasks={tasks}
        onSelect={selectTask}
        onEdit={selectTask}
        onReopen={toggleComplete}
        onSetPriority={setPriority}
        onDelete={(task) => setDeleteTaskId(task.id)}
      />
    ) : (
      <SettingsView
        themePreset={themePreset}
        appearanceMode={appearanceMode}
        status={status}
        diagnostics={diagnostics}
        operationError={operationError}
        isOperating={isOperating}
        githubReconnectAvailable={githubReconnectAvailable}
        githubReconnect={githubReconnect}
        onThemePresetChange={onThemePresetChange}
        onAppearanceModeChange={onAppearanceModeChange}
        onSync={syncNow}
        onReconnectGitHub={reconnectGitHub}
      />
    );

  const workspaceSurface =
    destination === "settings" ? null : layoutMode === "narrow" ? (
      <TaskWorkspaceBottomSheet
        workspace={workspacePresentation}
        externalError={operationError}
        isSaving={isOperating}
        recurrenceSeries={selectedRecurrenceSeries}
        onDraftChange={changeWorkspaceDraft}
        onSave={saveWorkspace}
        onDelete={(task) => setDeleteTaskId(task.id)}
        onToggleComplete={toggleComplete}
        onClose={closeWorkspace}
      />
    ) : (
      <TaskWorkspaceDrawer
        workspace={workspacePresentation}
        externalError={operationError}
        isSaving={isOperating}
        recurrenceSeries={selectedRecurrenceSeries}
        onDraftChange={changeWorkspaceDraft}
        onSave={saveWorkspace}
        onDelete={(task) => setDeleteTaskId(task.id)}
        onToggleComplete={toggleComplete}
        onClose={closeWorkspace}
      />
    );

  return (
    <>
        <ApplicationShell
          topNav={
            <PlannerHeader
              destination={destination}
              layoutMode={layoutMode}
              weekLabel={formatPlannerWeekRange(
                plannerState.displayedWeekStart,
              )}
              statusControl={statusControl}
              compactStatusControl={compactStatusControl}
              onHome={() => navigateDestination("planner")}
              onPreviousWeek={previousWeek}
              onToday={goToToday}
              onNextWeek={nextWeek}
              onAdd={() =>
                openCreate(
                  defaultAddDate(
                    plannerState.displayedWeekStart,
                    todayCivilDate(),
                  ),
                )
              }
              onNavigate={navigateDestination}
            />
          }
          banner={durableBanner ?? undefined}
        >
          <div className="jig-content-frame">
            <div
              className="jig-content"
              onPointerDown={dismissWorkspaceFromContent}
            >
              {content}
            </div>
          </div>
          {workspaceSurface}
        </ApplicationShell>

        <AlertDialog
          isOpen={deleteTask !== null}
          onOpenChange={(open) => {
            if (!open && !isOperating) {
              setDeleteTaskId(null);
            }
          }}
          title="Delete task?"
          description={
            deleteTask === null
              ? "This permanently removes the Task."
              : `Delete “${deleteTask.title}”? This cannot be undone in Jig.`
          }
          actionLabel="Delete task"
          cancelLabel="Cancel"
          actionVariant="destructive"
          isActionLoading={isOperating}
          onAction={async () => {
            if (deleteTask === null) {
              return;
            }
            const deleted = await runCommand({
              type: "delete",
              task_id: deleteTask.id,
            });
            if (deleted !== null) {
              const deletedId = deleteTask.id;
              setDeleteTaskId(null);
              setWorkspace((current) =>
                workspaceTaskId(current) === deletedId
                  ? { mode: "closed" }
                  : current,
              );
            }
          }}
        />

        <ReminderMonitor tasks={tasks} now={reminderNow} />
    </>
  );
}


export function App(): React.ReactElement {
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [themePreset, setThemePreset] =
    useState<ThemePreset>(readThemePreset);
  const [appearanceMode, setAppearanceMode] =
    useState<AppearanceMode>(readAppearanceMode);

  const refreshSetup = useCallback(async (): Promise<void> => {
    setSetupError(null);
    try {
      setSetupStatus(await readSetupStatus());
    } catch (error) {
      setSetupError(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    void refreshSetup();
  }, [refreshSetup]);

  const changeThemePreset = (value: ThemePreset): void => {
    setThemePreset(value);
    writeThemePreset(value);
  };
  const changeAppearanceMode = (value: AppearanceMode): void => {
    setAppearanceMode(value);
    writeAppearanceMode(value);
  };

  const bootstrapBody =
    setupStatus?.mode === "bootstrap" ? (
      <SetupView status={setupStatus} />
    ) : (
      <div className="jig-loading">
        {setupError === null ? (
          <p>Opening Jig…</p>
        ) : (
          <>
            <Banner
              status="error"
              title="Jig could not open"
              description={setupError}
              collapsible={false}
            />
            <Button
              label="Retry"
              variant="primary"
              onClick={() => {
                void refreshSetup();
              }}
            />
          </>
        )}
      </div>
    );

  return (
    <Theme theme={themeFor(themePreset)} mode={appearanceMode}>
      <LayerProvider>
        {setupStatus?.mode === "configured" ? (
          <ConfiguredApp
            themePreset={themePreset}
            appearanceMode={appearanceMode}
            onThemePresetChange={changeThemePreset}
            onAppearanceModeChange={changeAppearanceMode}
          />
        ) : (
          <ApplicationShell topNav={<OnboardingHeader />}>
            <div className="jig-content-frame">
              <div className="jig-content">{bootstrapBody}</div>
            </div>
          </ApplicationShell>
        )}
      </LayerProvider>
    </Theme>
  );
}
