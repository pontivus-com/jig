import {
  AlertDialog,
  AppShell,
  Banner,
  Button,
  LayerProvider,
  SideNav,
  SideNavItem,
  useAppShellMobile,
} from "@astryxdesign/core";
import { Theme } from "@astryxdesign/core/theme";
import jigLogoLightUrl from "../../assets/jig-logo.svg";
import jigLogoDarkUrl from "../../assets/jig-logo-on-dark.svg";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import type { Task, TaskCommand } from "../../src/core/task";
import {
  addCivilDays,
  completedForScheduledDate,
  outstandingForDate,
} from "../../src/core/planning";
import type {
  CanonicalState,
  CommandResult,
} from "../../src/shell/sqlite";
import type {
  Diagnostics,
  ServiceStatus,
} from "../../src/shell/http";
import { DayView } from "./day";
import {
  draftFor,
  type TaskDraft,
} from "./task-editor";
import { HistoryView } from "./history";
import {
  isStaleRevision,
  readCanonicalTasks,
  readDiagnostics,
  readStatus,
  submitTaskCommand,
  triggerSync,
} from "./http";
import { ReminderMonitor } from "./reminder";
import {
  SettingsView,
  type ThemePreference,
} from "./settings";
import {
  millisecondsUntilNextLocalDay,
  todayCivilDate,
} from "./dates";
import {
  TaskWorkspaceDrawer,
  type TaskWorkspaceMode,
} from "./task-workspace";
import { WeekView } from "./week";
import { jigTheme } from "./jig.js";

type Destination = "week" | "day" | "history" | "settings";

const THEME_STORAGE_KEY = "jig-theme";

function savedThemePreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function repositoryStatusLabel(status: ServiceStatus | null): string {
  switch (status?.repository_status) {
    case "local-only":
      return "Local only";
    case "pending":
      return "Sync pending";
    case "retrying":
      return "Retrying";
    case "synchronized":
      return "Synced";
    case "sync-issue":
      return "Sync issue";
    default:
      return "Status";
  }
}

function destinationLabel(destination: Destination): string {
  switch (destination) {
    case "week":
      return "Week";
    case "day":
      return "Day";
    case "history":
      return "History";
    case "settings":
      return "Settings";
  }
}

const NAV_ITEMS = [
  { destination: "day", icon: "calendar" },
  { destination: "week", icon: "viewColumns" },
  { destination: "history", icon: "clock" },
  { destination: "settings", icon: "wrench" },
] as const;

function ResponsiveFrame({
  destination,
  statusControl,
  onToday,
  children,
}: Readonly<{
  destination: Destination;
  statusControl: React.ReactNode;
  onToday: () => void;
  children: (isNarrow: boolean) => React.ReactNode;
}>): React.ReactElement {
  const { isMobile, openMobileNav } = useAppShellMobile();

  return (
    <div className="jig-content-frame">
      {isMobile ? (
        <>
          <header className="jig-mobile-header">
            <span className="jig-mobile-brand">Jig</span>
            {statusControl}
          </header>
          <div className="jig-mobile-surface-nav">
            <Button
              label={destinationLabel(destination)}
              variant="ghost"
              size="sm"
              endContent={<span aria-hidden="true">⌄</span>}
              onClick={openMobileNav}
              className="jig-mobile-destination-trigger"
            />
            {destination === "day" || destination === "week" ? (
              <Button
                label="Today"
                variant="secondary"
                size="sm"
                onClick={onToday}
                className="jig-mobile-today-control"
              />
            ) : null}
          </div>
        </>
      ) : null}
      <div className="jig-content">{children(isMobile)}</div>
    </div>
  );
}

function ResponsiveTaskWorkspaceDrawer({
  destination,
  ...props
}: Readonly<
  React.ComponentProps<typeof TaskWorkspaceDrawer> & {
    destination: Destination;
  }
>): React.ReactElement {
  const { isMobile } = useAppShellMobile();
  if (!isMobile && destination === "day") {
    return <></>;
  }
  return <TaskWorkspaceDrawer {...props} />;
}

export function App(): React.ReactElement {
  const [destination, setDestination] = useState<Destination>("day");
  const [selectedDate, setSelectedDate] = useState(todayCivilDate);
  const [observedToday, setObservedToday] = useState(todayCivilDate);
  const [canonical, setCanonical] = useState<CanonicalState | null>(null);
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [isOperating, setIsOperating] = useState(false);
  const [themePreference, setThemePreference] =
    useState<ThemePreference>(savedThemePreference);
  const [workspaceMode, setWorkspaceMode] =
    useState<TaskWorkspaceMode | null>(null);
  const [workspaceDate, setWorkspaceDate] = useState(selectedDate);
  const [workspaceDraft, setWorkspaceDraft] = useState<TaskDraft>(() =>
    draftFor(null, todayCivilDate()),
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);

  const tasks = canonical?.tasks ?? [];
  const selectedTask =
    selectedTaskId === null
      ? null
      : tasks.find((task) => task.id === selectedTaskId) ?? null;
  const deleteTask =
    deleteTaskId === null
      ? null
      : tasks.find((task) => task.id === deleteTaskId) ?? null;

  const refreshCanonical = useCallback(async (): Promise<void> => {
    const next = await readCanonicalTasks();
    setCanonical(next);
  }, []);

  const refreshOperationalState = useCallback(
    async (): Promise<void> => {
      const [nextStatus, nextDiagnostics] = await Promise.all([
        readStatus(),
        readDiagnostics(),
      ]);
      setStatus(nextStatus);
      setDiagnostics(nextDiagnostics);
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
    let cancelled = false;
    let boundaryTimer: number | null = null;

    const checkLocalDay = async (): Promise<boolean> => {
      const nextToday = todayCivilDate();
      if (nextToday === observedToday) {
        return false;
      }

      setSelectedDate((current) =>
        current === observedToday ? nextToday : current,
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

  useEffect(() => {
    if (destination !== "day" || canonical === null) {
      return;
    }

    const candidates = [
      ...outstandingForDate(tasks, selectedDate),
      ...completedForScheduledDate(tasks, selectedDate),
    ];
    if (
      selectedTaskId !== null &&
      candidates.some((task) => task.id === selectedTaskId)
    ) {
      return;
    }
    setSelectedTaskId(candidates[0]?.id ?? null);
  }, [canonical, destination, selectedDate, selectedTaskId, tasks]);

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
    async (task: Task): Promise<boolean> =>
      (await runCommand(
        task.completed_at === null
          ? { type: "complete", task_id: task.id }
          : { type: "reopen", task_id: task.id },
      )) !== null,
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

  const selectTask = useCallback((task: Task): void => {
    setSelectedTaskId(task.id);
    setWorkspaceDate(task.scheduled_date);
    setOperationError(null);
    setWorkspaceMode("view");
  }, []);

  const openCreate = useCallback((date: string): void => {
    setWorkspaceDate(date);
    setWorkspaceDraft(draftFor(null, date));
    setOperationError(null);
    setWorkspaceMode("create");
  }, []);

  const openEdit = useCallback((task: Task): void => {
    setSelectedTaskId(task.id);
    setWorkspaceDate(task.scheduled_date);
    setWorkspaceDraft(draftFor(task, task.scheduled_date));
    setOperationError(null);
    setWorkspaceMode("edit");
  }, []);

  const openMoveToDate = useCallback((task: Task): void => {
    setSelectedTaskId(task.id);
    setWorkspaceDate(task.scheduled_date);
    setOperationError(null);
    setWorkspaceMode("move");
  }, []);

  const saveWorkspace = useCallback(
    async (command: TaskCommand): Promise<boolean> => {
      const result = await runCommand(command);
      if (result === null || !("task" in result)) {
        return false;
      }
      setSelectedTaskId(result.task.id);
      setWorkspaceDate(result.task.scheduled_date);
      setSelectedDate(result.task.scheduled_date);
      setWorkspaceMode("view");
      return true;
    },
    [runCommand],
  );

  const moveWorkspaceTask = useCallback(
    async (task: Task, destinationDate: string): Promise<boolean> => {
      const destinationIndex = outstandingForDate(tasks, destinationDate)
        .filter((candidate) => candidate.id !== task.id)
        .length;
      const moved = await moveTaskExact(
        task.id,
        destinationDate,
        destinationIndex,
      );
      if (moved) {
        setWorkspaceDate(destinationDate);
        setSelectedDate(destinationDate);
        setWorkspaceMode("view");
      }
      return moved;
    },
    [moveTaskExact, tasks],
  );

  const closeWorkspace = useCallback((): void => {
    // Keep the last-selected Task rendered while Astryx Drawer completes its
    // exit animation. Selection remains presentation state and is replaced by
    // the next card selection or destination/date reconciliation.
    setWorkspaceMode(null);
  }, []);

  const changeWorkspaceMode = useCallback(
    (mode: TaskWorkspaceMode | null): void => {
      if (mode === "edit" && selectedTask !== null) {
        setWorkspaceDraft(draftFor(selectedTask, selectedTask.scheduled_date));
        setWorkspaceDate(selectedTask.scheduled_date);
      }
      setWorkspaceMode(mode);
    },
    [selectedTask],
  );

  const navigateDestination = useCallback((next: Destination): void => {
    setDestination(next);
    setWorkspaceMode(null);
  }, []);

  const changeTheme = useCallback((value: ThemePreference): void => {
    setThemePreference(value);
    try {
      if (value === "system") {
        window.localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        window.localStorage.setItem(THEME_STORAGE_KEY, value);
      }
    } catch {
      // Theme persistence is presentation-only and never affects Task state.
    }
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

  const navigateDate = (amount: number): void => {
    setSelectedDate((current) => addCivilDays(current, amount));
  };

  const goToToday = (stayInWeek: boolean): void => {
    setSelectedDate(todayCivilDate());
    setWorkspaceMode(null);
    if (!stayInWeek) {
      setDestination("day");
    }
  };

  const repositoryStatus = status?.repository_status ?? "unknown";
  const statusControl = (
    <Button
      label={repositoryStatusLabel(status)}
      variant="ghost"
      size="sm"
      icon={<span className="jig-status-dot" aria-hidden="true" />}
      onClick={() => navigateDestination("settings")}
      className={`jig-status-control jig-status-${repositoryStatus}`}
    />
  );

  const primarySideNav = (
    <SideNav
      className="jig-primary-nav"
      aria-label="Primary"
      header={
        <div className="jig-nav-brand" aria-label="Jig">
          <span className="jig-brand-logo-wrap" aria-hidden="true">
            <img
              className="jig-brand-logo jig-brand-logo-light"
              src={jigLogoLightUrl}
              alt=""
            />
            <img
              className="jig-brand-logo jig-brand-logo-dark"
              src={jigLogoDarkUrl}
              alt=""
            />
          </span>
        </div>
      }
    >
      {NAV_ITEMS.map((item) => (
        <SideNavItem
          key={item.destination}
          label={destinationLabel(item.destination)}
          icon={item.icon}
          size="sm"
          isSelected={destination === item.destination}
          onClick={() => navigateDestination(item.destination)}
        />
      ))}
    </SideNav>
  );

  const durableBanner = operationError !== null ? (
    <Banner
      status="error"
      title="Jig could not complete the operation"
      description={operationError}
      container="section"
      collapsible={false}
    />
  ) : status?.repository_status === "sync-issue" ? (
    <Banner
      status="warning"
      title="Repository synchronization issue"
      description="Local planning data remains safe. Repository synchronization currently has an operational issue."
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

  const renderContent = (isNarrow: boolean): React.ReactNode =>
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
    ) : destination === "week" ? (
      <WeekView
        tasks={tasks}
        selectedDate={selectedDate}
        isNarrow={isNarrow}
        onSelectDate={setSelectedDate}
        onPrevious={() => navigateDate(-7)}
        onToday={() => goToToday(true)}
        onNext={() => navigateDate(7)}
        statusControl={isNarrow ? null : statusControl}
        selectedTask={selectedTask}
        onSelectTask={selectTask}
        onAdd={openCreate}
        onEdit={openEdit}
        onMoveToDate={openMoveToDate}
        onToggleComplete={toggleComplete}
        onMove={moveTaskExact}
      />
    ) : destination === "day" ? (
      <DayView
        tasks={tasks}
        selectedDate={selectedDate}
        isNarrow={isNarrow}
        onSelectDate={setSelectedDate}
        onToday={() => goToToday(false)}
        statusControl={isNarrow ? null : statusControl}
        selectedTask={selectedTask}
        workspaceMode={workspaceMode}
        workspaceDate={workspaceDate}
        draft={workspaceDraft}
        externalError={operationError}
        isSaving={isOperating}
        onSelectTask={selectTask}
        onDelete={(task) => setDeleteTaskId(task.id)}
        onAdd={openCreate}
        onEdit={openEdit}
        onMoveToDate={openMoveToDate}
        onWorkspaceMove={moveWorkspaceTask}
        onWorkspaceModeChange={changeWorkspaceMode}
        onDraftChange={setWorkspaceDraft}
        onSave={saveWorkspace}
        onToggleComplete={toggleComplete}
        onMove={moveTaskExact}
      />
    ) : destination === "history" ? (
      <HistoryView
        tasks={tasks}
        onEdit={openEdit}
        onReopen={toggleComplete}
        onDelete={(task) => setDeleteTaskId(task.id)}
        statusControl={isNarrow ? null : statusControl}
      />
    ) : (
      <SettingsView
        themePreference={themePreference}
        status={status}
        diagnostics={diagnostics}
        operationError={operationError}
        isOperating={isOperating}
        onThemePreferenceChange={changeTheme}
        onSync={syncNow}
        statusControl={isNarrow ? null : statusControl}
      />
    );

  return (
    <Theme theme={jigTheme} mode={themePreference}>
      <LayerProvider>
        <AppShell
          className="jig-app-shell"
          sideNav={primarySideNav}
          mobileNav={{
            breakpoint: "md",
            hasToggle: false,
          }}
          banner={durableBanner ?? undefined}
          contentPadding={0}
          height="fill"
          variant="section"
        >
          <ResponsiveFrame
            destination={destination}
            statusControl={statusControl}
            onToday={() => goToToday(false)}
          >
            {renderContent}
          </ResponsiveFrame>

          <ResponsiveTaskWorkspaceDrawer
            destination={destination}
            mode={workspaceMode}
            task={workspaceMode === "create" ? null : selectedTask}
            initiatingDate={workspaceDate}
            draft={workspaceDraft}
            externalError={operationError}
            isSaving={isOperating}
            onModeChange={changeWorkspaceMode}
            onDraftChange={setWorkspaceDraft}
            onSave={saveWorkspace}
            onMove={moveWorkspaceTask}
            onDelete={(task) => setDeleteTaskId(task.id)}
            onToggleComplete={toggleComplete}
            onClose={closeWorkspace}
          />
        </AppShell>

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
              setDeleteTaskId(null);
              setSelectedTaskId(null);
              setWorkspaceMode(null);
            }
          }}
        />

        <ReminderMonitor tasks={tasks} />
      </LayerProvider>
    </Theme>
  );
}
