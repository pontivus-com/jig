import {
  Button,
  Collapsible,
  List,
  ListItem,
  RadioList,
  RadioListItem,
  createReorderable,
} from "@astryxdesign/core";
import { useMemo } from "react";

import type { RecurrenceSeries } from "../../../../src/core/recurrence";
import type { Task } from "../../../../src/core/task";
import { jigDataConflictKey } from "../../../../src/core/synchronization-recovery";
import type * as Recovery from "../../../../src/core/synchronization-recovery";
import { formatCivilDate } from "../../dates";
import { recurrenceSummary } from "../../task-editor";
import {
  syncConflictPreview,
  syncConflictResolution,
  type SyncConflictDraftAction,
  type SyncConflictDraftState,
} from "../../sync-conflict-state";

type ComparisonValue = readonly [label: string, value: string];

export interface SyncConflictContentProps {
  readonly state: SyncConflictDraftState;
  readonly error: string | null;
  readonly isResolving: boolean;
  readonly onAction: (action: SyncConflictDraftAction) => void;
  readonly onCopyTechnicalDetails: (value: string) => void;
}

export interface SyncConflictWorkspaceProps
  extends SyncConflictContentProps {
  readonly isOpen: boolean;
  readonly onCancel: () => void;
  readonly onResolve: () => Promise<void>;
}

function displayValue(value: string | null): string {
  return value === null || value.length === 0 ? "None" : value;
}

function taskValues(task: Task | null): readonly ComparisonValue[] {
  if (task === null) return [["State", "Deleted"]];
  return [
    ["Title", task.title],
    [
      "Date",
      formatCivilDate(task.scheduled_date, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    ],
    ["Priority", task.priority.toLowerCase()],
    ["Context", displayValue(task.context)],
    ["Reference", displayValue(task.reference)],
    ["Note", displayValue(task.note)],
    ["Reminder", displayValue(task.reminder_time)],
    ["Status", task.completed_at === null ? "Outstanding" : "Completed"],
    [
      "Recurrence",
      task.recurrence_series_id === null
        ? "Does not repeat"
        : "Recurring Task",
    ],
  ];
}

function changedTaskValues(
  local: Task | null,
  remote: Task | null,
  side: Recovery.ReconciliationSide,
): readonly ComparisonValue[] {
  const selected = side === "local" ? taskValues(local) : taskValues(remote);
  const other = side === "local" ? taskValues(remote) : taskValues(local);
  const otherByLabel = new Map(other);
  return selected.filter(
    ([label, value]) => otherByLabel.get(label) !== value,
  );
}

function familySchedule(
  series: readonly RecurrenceSeries[],
): string {
  return series.length === 0
    ? "None"
    : series.map(recurrenceSummary).join("; ");
}

function familyDates(tasks: readonly Task[]): string {
  const dates = [...new Set(tasks.map((task) => task.scheduled_date))].sort();
  return dates.length === 0
    ? "None"
    : dates
        .map((date) =>
          formatCivilDate(date, {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
        )
        .join(", ");
}

function familyTitles(tasks: readonly Task[]): string {
  const titles = tasks.map((task) => task.title);
  return titles.length === 0 ? "None" : titles.join(", ");
}

function familyValues(
  side: Recovery.Recovery.JigDataConflictFamilySide,
): readonly ComparisonValue[] {
  if (side.series.length === 0 && side.tasks.length === 0) {
    return [["State", "Deleted"]];
  }
  return [
    ["Series", String(side.series.length)],
    ["Schedule", familySchedule(side.series)],
    ["Tasks", String(side.tasks.length)],
    ["Task titles", familyTitles(side.tasks)],
    ["Affected dates", familyDates(side.tasks)],
  ];
}

function changedFamilyValues(
  conflict: Extract<
    Recovery.JigDataConflict,
    { readonly kind: "recurrence-family" }
  >,
  side: Recovery.ReconciliationSide,
): readonly ComparisonValue[] {
  const selected = familyValues(
    side === "local" ? conflict.local : conflict.remote,
  );
  const other = familyValues(
    side === "local" ? conflict.remote : conflict.local,
  );
  const otherByLabel = new Map(other);
  return selected.filter(
    ([label, value]) => otherByLabel.get(label) !== value,
  );
}

function sideDeleted(
  conflict: Recovery.JigDataConflict,
  side: Recovery.ReconciliationSide,
): boolean {
  if (conflict.kind === "task") {
    return (side === "local" ? conflict.local : conflict.remote) === null;
  }
  const value = side === "local" ? conflict.local : conflict.remote;
  return value.series.length === 0 && value.tasks.length === 0;
}

function choiceHeading(
  conflict: Recovery.JigDataConflict,
  side: Recovery.ReconciliationSide,
): string {
  if (sideDeleted(conflict, side)) return "Keep deleted";
  const other: Recovery.ReconciliationSide =
    side === "local" ? "remote" : "local";
  if (sideDeleted(conflict, other)) {
    return conflict.kind === "task"
      ? "Keep changed Task"
      : "Keep changed series";
  }
  return side === "local" ? "This device" : "Remote";
}

function comparisonValues(
  conflict: Recovery.JigDataConflict,
  side: Recovery.ReconciliationSide,
): readonly ComparisonValue[] {
  return conflict.kind === "task"
    ? changedTaskValues(conflict.local, conflict.remote, side)
    : changedFamilyValues(conflict, side);
}

function ChoiceSummary({
  conflict,
  side,
}: Readonly<{
  conflict: Recovery.JigDataConflict;
  side: Recovery.ReconciliationSide;
}>): React.ReactElement {
  const values = comparisonValues(conflict, side);
  return (
    <div className="jig-sync-conflict-choice">
      <strong>{choiceHeading(conflict, side)}</strong>
      {values.length === 0 ? (
        <span className="jig-sync-conflict-muted">
          No user-visible field difference. Technical details remain available.
        </span>
      ) : (
        <dl className="jig-sync-conflict-comparison">
          {values.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function conflictTitle(conflict: Recovery.JigDataConflict): string {
  if (conflict.kind === "task") {
    return (
      conflict.local?.title ??
      conflict.remote?.title ??
      conflict.ancestor?.title ??
      "Task"
    );
  }
  return (
    conflict.local.tasks[0]?.title ??
    conflict.remote.tasks[0]?.title ??
    conflict.ancestor.tasks[0]?.title ??
    "Recurring Tasks"
  );
}

function technicalDetails(
  state: SyncConflictDraftState,
  conflict: Recovery.JigDataConflict,
): string {
  return JSON.stringify(
    {
      reason: "semantic-conflict",
      ancestor_head: state.conflict_case.ancestor_head.slice(0, 12),
      local_head: state.conflict_case.local_head.slice(0, 12),
      remote_head: state.conflict_case.remote_head.slice(0, 12),
      conflict,
    },
    null,
    2,
  );
}

function ConflictChoice({
  state,
  conflict,
  onAction,
  onCopyTechnicalDetails,
}: Readonly<{
  state: SyncConflictDraftState;
  conflict: Recovery.JigDataConflict;
  onAction: (action: SyncConflictDraftAction) => void;
  onCopyTechnicalDetails: (value: string) => void;
}>): React.ReactElement {
  const key = jigDataConflictKey(conflict);
  const selected = state.choices.get(key) ?? "";
  const detailsOpen = state.technical_details.has(key);
  const technical = technicalDetails(state, conflict);

  return (
    <div className="jig-sync-conflict-choice-stage">
      <h3>{conflictTitle(conflict)}</h3>
      <RadioList
        label="Choose which planning data to keep"
        value={selected}
        onChange={(value) => {
          if (value === "local" || value === "remote") {
            onAction({
              type: "select-side",
              conflict_key: key,
              side: value,
            });
          }
        }}
      >
        <RadioListItem
          value="local"
          label={<ChoiceSummary conflict={conflict} side="local" />}
        />
        <RadioListItem
          value="remote"
          label={<ChoiceSummary conflict={conflict} side="remote" />}
        />
      </RadioList>

      <Collapsible
        trigger="Technical details"
        isOpen={detailsOpen}
        onOpenChange={(open) => {
          if (open !== detailsOpen) {
            onAction({
              type: "toggle-technical-details",
              conflict_key: key,
            });
          }
        }}
      >
        <div className="jig-sync-conflict-technical">
          <dl>
            <div>
              <dt>Reason</dt>
              <dd>semantic-conflict</dd>
            </div>
            <div>
              <dt>Ancestor</dt>
              <dd>{state.conflict_case.ancestor_head.slice(0, 12)}</dd>
            </div>
            <div>
              <dt>This device</dt>
              <dd>{state.conflict_case.local_head.slice(0, 12)}</dd>
            </div>
            <div>
              <dt>Remote</dt>
              <dd>{state.conflict_case.remote_head.slice(0, 12)}</dd>
            </div>
          </dl>
          <pre>{technical}</pre>
          <Button
            label="Copy conflict JSON"
            variant="secondary"
            size="sm"
            onClick={() => onCopyTechnicalDetails(technical)}
          />
        </div>
      </Collapsible>
    </div>
  );
}

function DateOrderReview({
  state,
  date,
  taskIds,
  onAction,
}: Readonly<{
  state: SyncConflictDraftState;
  date: string;
  taskIds: readonly string[];
  onAction: (action: SyncConflictDraftAction) => void;
}>): React.ReactElement {
  const preview = syncConflictPreview(state);
  const taskById = new Map(
    (preview?.tasks ?? []).map((task) => [task.id, task] as const),
  );
  const reorderable = useMemo(
    () =>
      createReorderable<string>({
        onReorder: ({ key, to }) =>
          onAction({
            type: "reorder-date-task",
            date,
            task_id: key,
            to_index: to,
          }),
      }),
    [date, onAction],
  );
  const confirmed = state.confirmed_date_orders.has(date);

  return (
    <section className="jig-sync-conflict-order-section">
      <div className="jig-sync-conflict-order-heading">
        <div>
          <h4>
            {formatCivilDate(date, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </h4>
          <p>Review the final Task order for this date.</p>
        </div>
        <Button
          label={confirmed ? "Order confirmed" : "Confirm order"}
          variant={confirmed ? "ghost" : "secondary"}
          size="sm"
          isDisabled={confirmed}
          onClick={() =>
            onAction({
              type: "confirm-date-order",
              date,
            })
          }
        />
      </div>
      <List
        density="compact"
        edge="padded"
        reorderable={reorderable}
        className="jig-sync-conflict-order-list"
      >
        {taskIds.map((taskId, index) => {
          const task = taskById.get(taskId);
          return (
            <ListItem
              key={taskId}
              itemKey={taskId}
              label={task?.title ?? "Task"}
              description={"Position " + String(index + 1)}
            />
          );
        })}
      </List>
    </section>
  );
}

function OrderReview({
  state,
  onAction,
}: Readonly<{
  state: SyncConflictDraftState;
  onAction: (action: SyncConflictDraftAction) => void;
}>): React.ReactElement {
  return (
    <div className="jig-sync-conflict-order-review">
      <div>
        <h3>Review Task order</h3>
        <p>
          Confirm the final order for every affected date. Drag a reorder
          handle or use its keyboard/touch Move controls.
        </p>
      </div>
      {[...state.date_orders.entries()].map(([date, taskIds]) => (
        <DateOrderReview
          key={date}
          state={state}
          date={date}
          taskIds={taskIds}
          onAction={onAction}
        />
      ))}
    </div>
  );
}

function ResolutionSummary({
  state,
}: Readonly<{
  state: SyncConflictDraftState;
}>): React.ReactElement {
  const localCount = [...state.choices.values()].filter(
    (side) => side === "local",
  ).length;
  const remoteCount = state.choices.size - localCount;
  const localLabel =
    String(localCount) + " choice" + (localCount === 1 ? "" : "s");
  const remoteLabel =
    String(remoteCount) + " choice" + (remoteCount === 1 ? "" : "s");
  const reviewed = state.confirmed_date_orders.size;
  const reviewLabel =
    String(reviewed) +
    " affected date" +
    (reviewed === 1 ? "" : "s") +
    " reviewed.";

  return (
    <div className="jig-sync-conflict-summary">
      <h3>Resolution ready</h3>
      <p>
        Jig will keep {localLabel} from this device and {remoteLabel} from
        the remote copy.
      </p>
      <p>
        {reviewed === 0
          ? "No Task-order changes require review."
          : reviewLabel}
      </p>
      <p>
        Nothing is written until you choose <strong>Use this resolution</strong>.
      </p>
    </div>
  );
}

export function SyncConflictContent({
  state,
  error,
  onAction,
  onCopyTechnicalDetails,
}: SyncConflictContentProps): React.ReactElement {
  const conflict = state.conflict_case.conflicts[state.conflict_index];

  return (
    <div className="jig-sync-conflict-content">
      <div className="jig-sync-conflict-intro">
        <p>
          Both installations changed the same planning data. Your local work
          is still saved.
        </p>
      </div>

      {error === null ? null : (
        <div className="jig-form-error" role="alert">
          {error}
        </div>
      )}

      {state.step === "choices" && conflict !== undefined ? (
        <>
          <div className="jig-sync-conflict-progress">
            <span>
              Conflict {state.conflict_index + 1} of{" "}
              {state.conflict_case.conflicts.length}
            </span>
            <div>
              <Button
                label="Previous conflict"
                variant="ghost"
                size="sm"
                isDisabled={state.conflict_index === 0}
                onClick={() =>
                  onAction({
                    type: "set-conflict-index",
                    index: state.conflict_index - 1,
                  })
                }
              />
              <Button
                label="Next conflict"
                variant="ghost"
                size="sm"
                isDisabled={
                  state.conflict_index >=
                  state.conflict_case.conflicts.length - 1
                }
                onClick={() =>
                  onAction({
                    type: "set-conflict-index",
                    index: state.conflict_index + 1,
                  })
                }
              />
            </div>
          </div>
          <ConflictChoice
            state={state}
            conflict={conflict}
            onAction={onAction}
            onCopyTechnicalDetails={onCopyTechnicalDetails}
          />
        </>
      ) : state.step === "order-review" ? (
        <OrderReview state={state} onAction={onAction} />
      ) : state.step === "confirm" ? (
        <ResolutionSummary state={state} />
      ) : (
        <div className="jig-form-error" role="alert">
          The synchronization conflict changed. Close this resolver and try
          again.
        </div>
      )}
    </div>
  );
}

export function SyncConflictActions({
  state,
  isResolving,
  onCancel,
  onResolve,
}: Pick<
  SyncConflictWorkspaceProps,
  "state" | "isResolving" | "onCancel" | "onResolve"
>): React.ReactElement {
  const resolution = syncConflictResolution(state);
  return (
    <div className="jig-sync-conflict-actions">
      <Button
        label="Cancel"
        variant="secondary"
        isDisabled={isResolving}
        onClick={onCancel}
      />
      <Button
        label="Use this resolution"
        variant="primary"
        isLoading={isResolving}
        isDisabled={resolution === null}
        onClick={() => {
          void onResolve();
        }}
      />
    </div>
  );
}
