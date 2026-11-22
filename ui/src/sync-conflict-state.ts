import type { PortableSnapshot } from "../../src/core/portable";
import {
  applyJigDataResolution,
  deriveJigDataDateOrders,
  jigDataConflictKey,
} from "../../src/core/synchronization-recovery";
import type * as Recovery from "../../src/core/synchronization-recovery";

export type SyncConflictStep =
  | "choices"
  | "order-review"
  | "confirm";

export interface SyncConflictDraftState {
  readonly conflict_case: Recovery.JigDataConflictCase;
  readonly step: SyncConflictStep;
  readonly conflict_index: number;
  readonly choices: ReadonlyMap<string, Recovery.ReconciliationSide>;
  readonly date_orders: ReadonlyMap<string, readonly string[]>;
  readonly confirmed_date_orders: ReadonlySet<string>;
  readonly technical_details: ReadonlySet<string>;
  readonly confirmation_intent: boolean;
}

export type SyncConflictDraftAction =
  | {
      readonly type: "select-side";
      readonly conflict_key: string;
      readonly side: Recovery.ReconciliationSide;
    }
  | {
      readonly type: "set-conflict-index";
      readonly index: number;
    }
  | {
      readonly type: "toggle-technical-details";
      readonly conflict_key: string;
    }
  | {
      readonly type: "move-date-task";
      readonly date: string;
      readonly task_id: string;
      readonly direction: "up" | "down";
    }
  | {
      readonly type: "reorder-date-task";
      readonly date: string;
      readonly task_id: string;
      readonly to_index: number;
    }
  | {
      readonly type: "confirm-date-order";
      readonly date: string;
    }
  | {
      readonly type: "set-confirmation-intent";
      readonly value: boolean;
    };

function conflictKeys(
  conflictCase: Recovery.JigDataConflictCase,
): ReadonlySet<string> {
  return new Set(
    conflictCase.conflicts.map((conflict) =>
      jigDataConflictKey(conflict)
    ),
  );
}

function choicesFor(
  conflictCase: Recovery.JigDataConflictCase,
  choices: ReadonlyMap<string, Recovery.ReconciliationSide>,
): readonly Recovery.JigDataConflictChoice[] {
  return conflictCase.conflicts.flatMap((conflict) => {
    const conflictKey = jigDataConflictKey(conflict);
    const side = choices.get(conflictKey);
    return side === undefined
      ? []
      : [{ conflict_key: conflictKey, side }];
  });
}

function requiredDateOrders(
  conflictCase: Recovery.JigDataConflictCase,
  choices: ReadonlyMap<string, Recovery.ReconciliationSide>,
): readonly Recovery.JigDataDateOrder[] | null {
  return deriveJigDataDateOrders(
    conflictCase,
    choicesFor(conflictCase, choices),
  );
}

function stepFor(
  conflictCase: Recovery.JigDataConflictCase,
  choices: ReadonlyMap<string, Recovery.ReconciliationSide>,
  confirmedDates: ReadonlySet<string>,
): SyncConflictStep {
  const required = requiredDateOrders(conflictCase, choices);
  if (required === null) return "choices";
  return required.every((order) => confirmedDates.has(order.date))
    ? "confirm"
    : "order-review";
}

function seededDateOrders(
  required: readonly Recovery.JigDataDateOrder[],
): ReadonlyMap<string, readonly string[]> {
  return new Map(
    required.map((order) => [order.date, order.task_ids] as const),
  );
}

function resolutionFromDraft(
  state: SyncConflictDraftState,
  requireConfirmedOrders: boolean,
): Recovery.JigDataResolution | null {
  const conflictCase = state.conflict_case;
  const choices = choicesFor(conflictCase, state.choices);
  const required = deriveJigDataDateOrders(conflictCase, choices);
  if (
    required === null ||
    (
      requireConfirmedOrders &&
      required.some(
        (order) => !state.confirmed_date_orders.has(order.date),
      )
    )
  ) {
    return null;
  }

  const dateOrders: Recovery.JigDataDateOrder[] = [];
  for (const requiredOrder of required) {
    const taskIds = state.date_orders.get(requiredOrder.date);
    if (taskIds === undefined) return null;
    dateOrders.push({
      date: requiredOrder.date,
      task_ids: taskIds,
    });
  }

  return {
    ancestor_head: conflictCase.ancestor_head,
    local_head: conflictCase.local_head,
    remote_head: conflictCase.remote_head,
    expected_revision: conflictCase.expected_revision,
    choices,
    date_orders: dateOrders,
  };
}

export function createSyncConflictDraft(
  conflictCase: Recovery.JigDataConflictCase,
): SyncConflictDraftState {
  return {
    conflict_case: conflictCase,
    step: "choices",
    conflict_index: 0,
    choices: new Map(),
    date_orders: new Map(),
    confirmed_date_orders: new Set(),
    technical_details: new Set(),
    confirmation_intent: false,
  };
}

export function reduceSyncConflictDraft(
  state: SyncConflictDraftState,
  action: SyncConflictDraftAction,
): SyncConflictDraftState {
  const conflictCase = state.conflict_case;
  switch (action.type) {
    case "select-side": {
      if (!conflictKeys(conflictCase).has(action.conflict_key)) {
        return state;
      }
      const choices = new Map(state.choices);
      choices.set(action.conflict_key, action.side);
      const required = requiredDateOrders(conflictCase, choices);
      const dateOrders =
        required === null ? new Map() : seededDateOrders(required);
      const confirmedDates = new Set<string>();
      return {
        ...state,
        step: stepFor(conflictCase, choices, confirmedDates),
        choices,
        date_orders: dateOrders,
        confirmed_date_orders: confirmedDates,
        confirmation_intent: false,
      };
    }

    case "set-conflict-index": {
      if (
        !Number.isInteger(action.index) ||
        action.index < 0 ||
        action.index >= conflictCase.conflicts.length
      ) {
        return state;
      }
      return {
        ...state,
        conflict_index: action.index,
        confirmation_intent: false,
      };
    }

    case "toggle-technical-details": {
      if (!conflictKeys(conflictCase).has(action.conflict_key)) {
        return state;
      }
      const technicalDetails = new Set(state.technical_details);
      if (technicalDetails.has(action.conflict_key)) {
        technicalDetails.delete(action.conflict_key);
      } else {
        technicalDetails.add(action.conflict_key);
      }
      return {
        ...state,
        technical_details: technicalDetails,
      };
    }

    case "move-date-task": {
      const current = state.date_orders.get(action.date);
      if (current === undefined) return state;
      const index = current.indexOf(action.task_id);
      if (index < 0) return state;
      const nextIndex =
        action.direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return state;
      }
      const nextOrder = [...current];
      const target = nextOrder[nextIndex];
      if (target === undefined) return state;
      nextOrder[nextIndex] = action.task_id;
      nextOrder[index] = target;
      const dateOrders = new Map(state.date_orders);
      dateOrders.set(action.date, nextOrder);
      const confirmedDates = new Set(state.confirmed_date_orders);
      confirmedDates.delete(action.date);
      return {
        ...state,
        step: stepFor(
          conflictCase,
          state.choices,
          confirmedDates,
        ),
        date_orders: dateOrders,
        confirmed_date_orders: confirmedDates,
        confirmation_intent: false,
      };
    }

    case "reorder-date-task": {
      const current = state.date_orders.get(action.date);
      if (
        current === undefined ||
        !Number.isInteger(action.to_index) ||
        action.to_index < 0 ||
        action.to_index >= current.length
      ) {
        return state;
      }
      const fromIndex = current.indexOf(action.task_id);
      if (fromIndex < 0 || fromIndex === action.to_index) {
        return state;
      }
      const nextOrder = [...current];
      nextOrder.splice(fromIndex, 1);
      nextOrder.splice(action.to_index, 0, action.task_id);
      const dateOrders = new Map(state.date_orders);
      dateOrders.set(action.date, nextOrder);
      const confirmedDates = new Set(state.confirmed_date_orders);
      confirmedDates.delete(action.date);
      return {
        ...state,
        step: stepFor(
          conflictCase,
          state.choices,
          confirmedDates,
        ),
        date_orders: dateOrders,
        confirmed_date_orders: confirmedDates,
        confirmation_intent: false,
      };
    }

    case "confirm-date-order": {
      const required = requiredDateOrders(
        conflictCase,
        state.choices,
      );
      const expected = required?.find(
        (order) => order.date === action.date,
      );
      const current = state.date_orders.get(action.date);
      if (
        expected === undefined ||
        current === undefined ||
        expected.task_ids.length !== current.length ||
        [...expected.task_ids].sort().some(
          (taskId, index) =>
            taskId !== [...current].sort()[index],
        )
      ) {
        return state;
      }
      const confirmedDates = new Set(state.confirmed_date_orders);
      confirmedDates.add(action.date);
      return {
        ...state,
        step: stepFor(
          conflictCase,
          state.choices,
          confirmedDates,
        ),
        confirmed_date_orders: confirmedDates,
        confirmation_intent: false,
      };
    }

    case "set-confirmation-intent":
      return {
        ...state,
        confirmation_intent: action.value,
      };
  }
}

export function syncConflictPreview(
  state: SyncConflictDraftState,
): PortableSnapshot | null {
  const resolution = resolutionFromDraft(state, false);
  if (resolution === null) return null;
  const result = applyJigDataResolution(
    state.conflict_case,
    resolution,
  );
  return result.kind === "resolved" ? result.snapshot : null;
}

export function syncConflictResolution(
  state: SyncConflictDraftState,
): Recovery.JigDataResolution | null {
  const resolution = resolutionFromDraft(state, true);
  if (resolution === null) return null;
  return applyJigDataResolution(
    state.conflict_case,
    resolution,
  ).kind === "resolved"
    ? resolution
    : null;
}
