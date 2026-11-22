import {
  AlertDialog,
  Button,
  Icon,
  IconButton,
  LayerProvider,
} from "@astryxdesign/core";
import { Theme } from "@astryxdesign/core/theme";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Task, TaskCommand } from "../../src/core/task";
import {
  clampPlannerHorizonStart,
  movePlannerHorizon,
  plannerHorizonDates,
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
  readCanonicalTasksAfterActivationRollover,
  readDiagnostics,
  readStatus,
  reconcileRuntimeReminders,
  rollForwardRuntimeLocalDay,
  submitTaskCommand,
  triggerSync,
} from "./runtime";
import { Planner, type WeekTransitionDirection } from "./planner";
import {
  ReminderMonitor,
  useReminderClock,
} from "./reminder";
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
  formatPlannerHorizonRange,
  millisecondsUntilNextLocalDay,
  todayCivilDate,
} from "./dates";
import {
  type TaskWorkspacePresentation,
  type TaskWorkspaceState,
} from "./task-workspace";
import { useLayoutMode, type LayoutMode } from "./use-layout-mode";
import { DesktopConfiguredApplication } from "./presentation/desktop/configured-application";
import { NarrowConfiguredApplication } from "./presentation/narrow/configured-application";
import { ApplicationShell } from "./presentation/shared/application-shell";
import { SetupView } from "./setup";
import { JigLogo } from "./jig-logo";
import {
  AttentionFeedbackContent,
  SuccessFeedbackContent,
} from "./presentation/shared/feedback-content";
import {
  installNativeActiveListener,
  installNativeBackButtonListener,
} from "./native/app-lifecycle";
import { NativeSystemBars } from "./native/system-bars";
import type { Destination } from "./destinations";
import {
  initialDestinationNavigation,
  navigateDestination as navigateDestinationState,
  previousDestination,
} from "./navigation";
import {
  readGitHubCapabilityStatus,
  readGitHubReconnectState,
  readSetupStatus,
  reconnectGitHub as reconnectGitHubIntent,
  resumeGitHubReconnect,
  resumeGitHubSetup,
  type GitHubReconnectSnapshot,
  type SetupStatus,
} from "./setup-http";
interface PlannerState {
  readonly displayedHorizonStart: string;
}

function initialPlannerState(): PlannerState {
  const today = todayCivilDate();
  return {
    displayedHorizonStart: today,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
  readonly layoutMode: LayoutMode;
  readonly themePreset: ThemePreset;
  readonly appearanceMode: AppearanceMode;
  readonly onThemePresetChange: (value: ThemePreset) => void;
  readonly onAppearanceModeChange: (value: AppearanceMode) => void;
  readonly nativeActiveHandlerRef: React.MutableRefObject<
    () => Promise<void>
  >;
  readonly nativeBackHandlerRef: React.MutableRefObject<() => boolean>;
}

function ConfiguredApp({
  layoutMode,
  themePreset,
  appearanceMode,
  onThemePresetChange,
  onAppearanceModeChange,
  nativeActiveHandlerRef,
  nativeBackHandlerRef,
}: ConfiguredAppProps): React.ReactElement {
  const [, setReminderDeliveryRevision] = useState(0);
  const onReminderNotified = useCallback(() => {
    setReminderDeliveryRevision((revision) => revision + 1);
  }, []);
  const reminderNow = useReminderClock();
  const [destinationNavigation, setDestinationNavigation] = useState(
    initialDestinationNavigation,
  );
  const [destinationTransition, setDestinationTransition] =
    useState<Destination | null>(null);
  const [plannerState, setPlannerState] =
    useState<PlannerState>(initialPlannerState);
  const [todayScrollRequest, setTodayScrollRequest] = useState<number | null>(null);
  const todayScrollSequenceRef = useRef(0);
  const [initialTodayFocusPending, setInitialTodayFocusPending] =
    useState(() => layoutMode === "narrow");
  const [weekTransitionDirection, setWeekTransitionDirection] =
    useState<WeekTransitionDirection | null>(null);
  const [observedToday, setObservedToday] = useState(todayCivilDate);
  const [canonical, setCanonical] = useState<CanonicalState | null>(null);
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [githubReconnectAvailable, setGitHubReconnectAvailable] =
    useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operationConfirmation, setOperationConfirmation] = useState<
    string | null
  >(null);
  const [initialSyncSettled, setInitialSyncSettled] = useState(false);
  const [dismissedSyncAttention, setDismissedSyncAttention] = useState<
    string | null
  >(null);
  const [isOperating, setIsOperating] = useState(false);
  const [githubReconnect, setGitHubReconnect] =
    useState<GitHubReconnectSnapshot | null>(null);
  const [showSettingsDiagnostics, setShowSettingsDiagnostics] =
    useState(false);
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
  const displayedDates = plannerHorizonDates(
    plannerState.displayedHorizonStart,
  );

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

  const updateRepositoryStatus = useCallback(
    (repositoryStatus: ServiceStatus["repository_status"]): void => {
      setStatus((current) =>
        current === null
          ? current
          : {
              ...current,
              repository_status: repositoryStatus,
            },
      );
    },
    [],
  );


  const applyObservedLocalDay = useCallback(
    (nextToday: string): void => {
      if (nextToday === observedToday) {
        return;
      }
      setWeekTransitionDirection(null);
      setPlannerState((current) => {
        const nextStart =
          current.displayedHorizonStart === observedToday
            ? nextToday
            : clampPlannerHorizonStart(
                current.displayedHorizonStart,
                nextToday,
              );
        return nextStart === current.displayedHorizonStart
          ? current
          : { displayedHorizonStart: nextStart };
      });
      setObservedToday(nextToday);
    },
    [observedToday],
  );

  const load = useCallback(async (): Promise<void> => {
    setLoadError(null);
    setInitialSyncSettled(false);
    try {
      await Promise.all([
        refreshCanonical(),
        refreshOperationalState(),
      ]);
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setInitialSyncSettled(true);
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
        .then(updateRepositoryStatus)
        .catch(() => undefined);
    };
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
    };
  }, []);


  const activateConfiguredRuntime = useCallback(
    async (): Promise<void> => {
      const nextToday = todayCivilDate();
      if (nextToday !== observedToday) {
        await rollForwardRuntimeLocalDay();
        applyObservedLocalDay(nextToday);
      }

      await resumeGitHubReconnect();

      const preSyncCanonical =
        await readCanonicalTasksAfterActivationRollover();

      await reconcileRuntimeReminders(
        preSyncCanonical.tasks,
        new Date(),
      );

      await triggerSync();

      const [
        nextCanonical,
        nextStatus,
        nextDiagnostics,
        githubCapabilities,
      ] = await Promise.all([
        readCanonicalTasksAfterActivationRollover(),
        readStatus(),
        readDiagnostics(),
        readGitHubCapabilityStatus(),
      ]);

      setCanonical(nextCanonical);
      setStatus(nextStatus);
      setDiagnostics(nextDiagnostics);
      setGitHubReconnectAvailable(
        githubCapabilities.reconnect_available,
      );
      setInitialSyncSettled(true);
    },
    [applyObservedLocalDay, observedToday],
  );

  const handleNativeActive = useCallback(async (): Promise<void> => {
    try {
      await activateConfiguredRuntime();
    } catch (error) {
      setOperationError(
        `Jig could not refresh after Android resumed: ${errorMessage(error)}. Reload the application.`,
      );
    }
  }, [activateConfiguredRuntime]);

  useEffect(() => {
    nativeActiveHandlerRef.current = handleNativeActive;
    return () => {
      if (nativeActiveHandlerRef.current === handleNativeActive) {
        nativeActiveHandlerRef.current = async () => undefined;
      }
    };
  }, [handleNativeActive, nativeActiveHandlerRef]);

  useEffect(() => {
    let cancelled = false;
    let boundaryTimer: number | null = null;

    const checkLocalDay = async (): Promise<boolean> => {
      const nextToday = todayCivilDate();
      if (nextToday === observedToday) {
        return false;
      }

      applyObservedLocalDay(nextToday);

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
  }, [applyObservedLocalDay, observedToday, refreshCanonical]);

  const runCommand = useCallback(
    async (command: TaskCommand): Promise<CommandResult | null> => {
      if (canonical === null || isOperating) {
        return null;
      }

      setOperationError(null);
      setOperationConfirmation(null);
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
      const completing = task.completed_at === null;
      const changed =
        (await runCommand(
          completing
            ? { type: "complete", task_id: task.id }
            : { type: "reopen", task_id: task.id },
        )) !== null;
      if (changed) {
        setOperationConfirmation(completing ? "Task completed" : "Task reopened");
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
    const recurrenceSeries =
      task.recurrence_series_id === null
        ? null
        : canonical?.recurrences.find(
            (series) => series.id === task.recurrence_series_id,
          ) ?? null;
    setWorkspace({
      mode: "task",
      taskId: task.id,
      draft: draftFor(task, task.scheduled_date, recurrenceSeries),
    });
  }, [canonical?.recurrences]);

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
      const workspaceMode = workspace.mode;
      const result = await runCommand(command);
      if (result === null || !("task" in result)) {
        return false;
      }
      setWorkspace({ mode: "closed" });
      setOperationConfirmation(
        workspaceMode === "create" ? "Task added" : "Task saved",
      );
      return true;
    },
    [runCommand, workspace.mode],
  );

  const closeWorkspace = useCallback((): void => {
    setWorkspace({ mode: "closed" });
  }, []);

  const dismissOperationConfirmation = useCallback((): void => {
    setOperationConfirmation(null);
  }, []);

  const changeWorkspaceDraft = useCallback((draft: TaskDraft): void => {
    setWorkspace((current) =>
      current.mode === "task" || current.mode === "create"
        ? { ...current, draft }
        : current,
    );
  }, []);

  const navigateDestination = useCallback((next: Destination): void => {
    if (destinationNavigation.current !== next) {
      setDestinationTransition(next);
    }
    setDestinationNavigation((current) =>
      navigateDestinationState(current, next),
    );
    setWorkspace({ mode: "closed" });
  }, [destinationNavigation]);

  const handleBack = useCallback((): boolean => {
    if (deleteTaskId !== null) {
      if (!isOperating) {
        setDeleteTaskId(null);
      }
      return true;
    }

    if (workspace.mode !== "closed") {
      closeWorkspace();
      return true;
    }

    const previous = previousDestination(destinationNavigation);
    if (previous === null) {
      return false;
    }

    setDestinationTransition(previous.current);
    setDestinationNavigation(previous);
    return true;
  }, [
    closeWorkspace,
    deleteTaskId,
    destinationNavigation,
    isOperating,
    workspace.mode,
  ]);

  useEffect(() => {
    nativeBackHandlerRef.current = handleBack;
    return () => {
      if (nativeBackHandlerRef.current === handleBack) {
        nativeBackHandlerRef.current = () => false;
      }
    };
  }, [handleBack, nativeBackHandlerRef]);

  const destination = destinationNavigation.current;

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

  const requestPreviousWeek = useCallback((): void => {
    setWeekTransitionDirection(null);
    const today = todayCivilDate();
    setPlannerState((current) => ({
      displayedHorizonStart: movePlannerHorizon(
        current.displayedHorizonStart,
        today,
        -7,
      ),
    }));
  }, []);

  const requestNextWeek = useCallback((): void => {
    setWeekTransitionDirection(null);
    const today = todayCivilDate();
    setPlannerState((current) => ({
      displayedHorizonStart: movePlannerHorizon(
        current.displayedHorizonStart,
        today,
        7,
      ),
    }));
  }, []);

  const goToToday = useCallback((): void => {
    const today = todayCivilDate();
    const horizonChanged =
      plannerState.displayedHorizonStart !== today;

    setWeekTransitionDirection(
      layoutMode === "desktop" && horizonChanged ? "today" : null,
    );
    if (horizonChanged) {
      setPlannerState({
        displayedHorizonStart: today,
      });
    }
    if (layoutMode === "narrow") {
      todayScrollSequenceRef.current += 1;
      setTodayScrollRequest(todayScrollSequenceRef.current);
    }
  }, [layoutMode, plannerState.displayedHorizonStart]);
  const clearInitialTodayFocus = useCallback((): void => {
    setInitialTodayFocusPending(false);
  }, []);

  const clearTodayScrollRequest = useCallback((): void => {
    setTodayScrollRequest(null);
  }, []);

  const repositoryStatus = repositoryStatusPresentation(status, {
    initialSync: !initialSyncSettled,
  });

  useEffect(() => {
    if (repositoryStatus.key !== "sync-issue") {
      setDismissedSyncAttention(null);
    }
  }, [repositoryStatus.key]);

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
      className={`jig-status-indicator jig-status-${repositoryStatus.key}`}
    />
  );

  const durableBanner =
    operationError !== null && workspace.mode === "closed" ? (
    <AttentionFeedbackContent
      status="error"
      title="Jig could not complete the operation"
      message={operationError}
      container="section"
      onDismiss={() => setOperationError(null)}
    />
  ) : repositoryStatus.key === "sync-issue" &&
    destination !== "settings" &&
    dismissedSyncAttention !== repositoryStatus.message ? (
    <AttentionFeedbackContent
      status="warning"
      title="Sync needs attention"
      message={repositoryStatus.message}
      container="section"
      onDismiss={() => setDismissedSyncAttention(repositoryStatus.message)}
      action={
        <Button
          label="Open Settings"
          variant="secondary"
          size="sm"
          onClick={() => navigateDestination("settings")}
        />
      }
    />
  ) : null;

  const operationConfirmationView =
    operationConfirmation === null ? null : (
      <SuccessFeedbackContent
        message={operationConfirmation}
        onDismiss={dismissOperationConfirmation}
      />
    );

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
            <AttentionFeedbackContent
              status="error"
              title="Jig could not load local planning data"
              message={loadError}
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
        focusCurrentDayOnMount={initialTodayFocusPending}
        onInitialTodayFocusHandled={clearInitialTodayFocus}
        todayScrollRequest={todayScrollRequest}
        onTodayScrollHandled={clearTodayScrollRequest}
        weekTransitionDirection={weekTransitionDirection}
        tasks={tasks}
        recurrences={canonical.recurrences}
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
        showDiagnostics={showSettingsDiagnostics}
        onShowDiagnosticsChange={setShowSettingsDiagnostics}
      />
    );


  const configuredPresentation =
    layoutMode === "desktop" ? (
      <DesktopConfiguredApplication
        destination={destination}
        weekLabel={formatPlannerHorizonRange(
          plannerState.displayedHorizonStart,
        )}
        canGoPrevious={
          plannerState.displayedHorizonStart > todayCivilDate()
        }
        statusControl={statusControl}
        compactStatusControl={compactStatusControl}
        onHome={() => navigateDestination("planner")}
        onPreviousWeek={requestPreviousWeek}
        onToday={goToToday}
        onNextWeek={requestNextWeek}
        onAdd={() => openCreate(todayCivilDate())}
        onNavigate={navigateDestination}
        content={content}
        durableFeedback={durableBanner}
        transientFeedback={operationConfirmationView}
        workspace={workspacePresentation}
        destinationTransition={destinationTransition}
        todayScrollRequest={todayScrollRequest}
        onContentPointerDown={dismissWorkspaceFromContent}
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
      <NarrowConfiguredApplication
        destination={destination}
        weekLabel={formatPlannerHorizonRange(
          plannerState.displayedHorizonStart,
        )}
        canGoPrevious={
          plannerState.displayedHorizonStart > todayCivilDate()
        }
        statusControl={statusControl}
        compactStatusControl={compactStatusControl}
        onHome={() => navigateDestination("planner")}
        onPreviousWeek={requestPreviousWeek}
        onToday={goToToday}
        onNextWeek={requestNextWeek}
        onAdd={() => openCreate(todayCivilDate())}
        onNavigate={navigateDestination}
        content={content}
        durableFeedback={durableBanner}
        transientFeedback={operationConfirmationView}
        workspace={workspacePresentation}
        destinationTransition={destinationTransition}
        todayScrollRequest={todayScrollRequest}
        onContentPointerDown={dismissWorkspaceFromContent}
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
      {configuredPresentation}
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

        <ReminderMonitor
          tasks={tasks}
          now={reminderNow}
          onReminderNotified={onReminderNotified}
        />
    </>
  );
}


export function App(): React.ReactElement {
  const layoutMode = useLayoutMode();
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [themePreset, setThemePreset] =
    useState<ThemePreset>(readThemePreset);
  const [appearanceMode, setAppearanceMode] =
    useState<AppearanceMode>(readAppearanceMode);

  const nativeActiveHandlerRef = useRef<() => Promise<void>>(
    async () => undefined,
  );
  const nativeBackHandlerRef = useRef<() => boolean>(() => false);

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


  const handleBootstrapNativeActive = useCallback(
    async (): Promise<void> => {
      try {
        await resumeGitHubSetup();
        await refreshSetup();
      } catch (error) {
        setSetupError(errorMessage(error));
      }
    },
    [refreshSetup],
  );

  useEffect(() => {
    if (setupStatus?.mode === "configured") {
      return;
    }
    nativeActiveHandlerRef.current = handleBootstrapNativeActive;
    nativeBackHandlerRef.current = () => false;
  }, [handleBootstrapNativeActive, setupStatus?.mode]);

  useEffect(() => {
    let disposed = false;
    let removeActive: (() => Promise<void>) | null = null;
    let removeBack: (() => Promise<void>) | null = null;

    void Promise.all([
      installNativeActiveListener(() => {
        void nativeActiveHandlerRef.current();
      }),
      installNativeBackButtonListener(
        () => nativeBackHandlerRef.current(),
      ),
    ]).then(([nextRemoveActive, nextRemoveBack]) => {
      if (disposed) {
        void nextRemoveActive();
        void nextRemoveBack();
        return;
      }
      removeActive = nextRemoveActive;
      removeBack = nextRemoveBack;
    });

    return () => {
      disposed = true;
      if (removeActive !== null) {
        void removeActive();
      }
      if (removeBack !== null) {
        void removeBack();
      }
    };
  }, []);

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
      <SetupView status={setupStatus} layoutMode={layoutMode} />
    ) : (
      <div className="jig-loading">
        {setupError === null ? (
          <p>Opening Jig…</p>
        ) : (
          <>
            <AttentionFeedbackContent
              status="error"
              title="Jig could not open"
              message={setupError}
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
      <NativeSystemBars />
      <LayerProvider>
        {setupStatus?.mode === "configured" ? (
          <ConfiguredApp
            layoutMode={layoutMode}
            themePreset={themePreset}
            appearanceMode={appearanceMode}
            onThemePresetChange={changeThemePreset}
            onAppearanceModeChange={changeAppearanceMode}
            nativeActiveHandlerRef={nativeActiveHandlerRef}
            nativeBackHandlerRef={nativeBackHandlerRef}
          />
        ) : (
          <ApplicationShell topNav={<OnboardingHeader />}>
            <div className="jig-content-frame jig-content-frame-onboarding">
              <div className="jig-content">{bootstrapBody}</div>
            </div>
          </ApplicationShell>
        )}
      </LayerProvider>
    </Theme>
  );
}
