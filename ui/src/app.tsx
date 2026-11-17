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
import type { CanonicalState } from "../../src/shell/sqlite";
import type {
  Diagnostics,
  ServiceStatus,
} from "../../src/shell/http";
import { DayView } from "./day";
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
  MoveTaskDialog,
  TaskEditor,
} from "./task-editor";
import {
  millisecondsUntilNextLocalDay,
  todayCivilDate,
} from "./dates";
import { WeekView } from "./week";
import { jigTheme } from "./theme";

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

function ResponsiveTaskEditor(
  props: Omit<React.ComponentProps<typeof TaskEditor>, "isNarrow">,
): React.ReactElement {
  const { isMobile } = useAppShellMobile();
  return <TaskEditor {...props} isNarrow={isMobile} />;
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
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTaskId, setEditorTaskId] = useState<string | null>(null);
  const [editorDate, setEditorDate] = useState(selectedDate);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveTaskId, setMoveTaskId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);

  const tasks = canonical?.tasks ?? [];
  const editorTask =
    editorTaskId === null
      ? null
      : tasks.find((task) => task.id === editorTaskId) ?? null;
  const moveTask =
    moveTaskId === null
      ? null
      : tasks.find((task) => task.id === moveTaskId) ?? null;
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
    async (command: TaskCommand): Promise<boolean> => {
      if (canonical === null || isOperating) {
        return false;
      }

      setOperationError(null);
      setIsOperating(true);
      try {
        await submitTaskCommand(command, canonical.revision);
        try {
          await refreshCanonical();
        } catch (refreshError) {
          setOperationError(
            `Saved locally, but Jig could not refresh the view: ${errorMessage(refreshError)}. Reload the application.`,
          );
          return true;
        }
        void readStatus().then(setStatus).catch(() => undefined);
        return true;
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
          return false;
        }

        setOperationError(errorMessage(error));
        return false;
      } finally {
        setIsOperating(false);
      }
    },
    [canonical, isOperating, refreshCanonical],
  );

  const toggleComplete = useCallback(
    async (task: Task): Promise<boolean> =>
      runCommand(
        task.completed_at === null
          ? { type: "complete", task_id: task.id }
          : { type: "reopen", task_id: task.id },
      ),
    [runCommand],
  );

  const moveTaskExact = useCallback(
    async (
      taskId: string,
      destinationDate: string,
      destinationIndex: number,
    ): Promise<boolean> =>
      runCommand({
        type: "move",
        task_id: taskId,
        destination_date: destinationDate,
        destination_index: destinationIndex,
      }),
    [runCommand],
  );

  const openCreate = useCallback((date: string): void => {
    setEditorTaskId(null);
    setEditorDate(date);
    setOperationError(null);
    setEditorOpen(true);
  }, []);

  const openEdit = useCallback((task: Task): void => {
    setEditorTaskId(task.id);
    setEditorDate(task.scheduled_date);
    setOperationError(null);
    setEditorOpen(true);
  }, []);

  const openMoveToDate = useCallback((task: Task): void => {
    setMoveTaskId(task.id);
    setOperationError(null);
    setMoveDialogOpen(true);
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
      onClick={() => setDestination("settings")}
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
          <span className="jig-brand-tagline">Schedules attention</span>
        </div>
      }
      footer={
        <div className="jig-nav-context">
          <span>Planning data</span>
          <small>Personal Git repository</small>
        </div>
      }
    >
      {(["week", "day", "history", "settings"] as const).map((item) => (
        <SideNavItem
          key={item}
          label={destinationLabel(item)}
          isSelected={destination === item}
          onClick={() => setDestination(item)}
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

  const renderContent = (isNarrow: boolean): React.ReactNode => canonical === null ? (
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
      onToday={() => goToToday(false)}
      onNext={() => navigateDate(7)}
      statusControl={isNarrow ? null : statusControl}
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
      onSelectTask={(task) => setSelectedTaskId(task.id)}
      onDelete={(task) => setDeleteTaskId(task.id)}
      onAdd={openCreate}
      onEdit={openEdit}
      onMoveToDate={openMoveToDate}
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

          <ResponsiveTaskEditor
            isOpen={editorOpen}
            task={editorTask}
            initiatingDate={editorDate}
            externalError={operationError}
            isSaving={isOperating}
            onOpenChange={setEditorOpen}
            onSave={runCommand}
            onDelete={(taskId) =>
              runCommand({ type: "delete", task_id: taskId })
            }
          />
        </AppShell>

        <MoveTaskDialog
          task={moveTask}
          isOpen={moveDialogOpen}
          initialDate={moveTask?.scheduled_date ?? selectedDate}
          isSaving={isOperating}
          error={operationError}
          onOpenChange={setMoveDialogOpen}
          onMove={async (destinationDate) => {
            if (moveTask === null) {
              return false;
            }
            const destinationIndex = outstandingForDate(
              tasks,
              destinationDate,
            ).filter((task) => task.id !== moveTask.id).length;
            return moveTaskExact(
              moveTask.id,
              destinationDate,
              destinationIndex,
            );
          }}
        />

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
            if (deleted) {
              setDeleteTaskId(null);
              setSelectedTaskId(null);
            }
          }}
        />

        <ReminderMonitor tasks={tasks} />
      </LayerProvider>
    </Theme>
  );
}
