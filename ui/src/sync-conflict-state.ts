import {
  applyJigDataResolution,
  deriveJigDataDateOrders,
  jigDataConflictKey,
  type JigDataConflictCase,
  type JigDataConflictChoice,
  type JigDataDateOrder,
  type JigDataResolution,
  type ReconciliationSide,
} from "../../src/core/synchronization-recovery";

export type SyncConflictStep =
  | "choices"
  | "order-review"
  | "confirm";

export interface SyncConflictDraftState {
  readonly step: SyncConflictStep;
  readonly conflict_index: number;
  readonly choices: ReadonlyMap<string, ReconciliationSide>;
  readonly date_orders: ReadonlyMap<string, readonly string[]>;
  readonly confirmed_date_orders: ReadonlySet<string>;
  readonly technical_details: ReadonlySet<string>;
  readonly confirmation_intent: boolean;
}

export type SyncConflictDraftAction =
  | {
      readonly type: "select-side";
      readonly conflict_key: string;
      readonly side: ReconciliationSide;
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
      readonly type: "set-date-order";
      readonly date: string;
      readonly task_ids: readonly string[];
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
  conflictCase: JigDataConflictCase,
): ReadonlySet<string> {
  return new Set(
    conflictCase.conflicts.map((conflict) =>
      jigDataConflictKey(conflict)
    ),
  );
}

function choicesFor(
  conflictCase: JigDataConflictCase,
  choices: ReadonlyMap<string, ReconciliationSide>,
): readonly JigDataConflictChoice[] {
  return conflictCase.conflicts.flatMap((conflict) => {
    const conflictKey = jigDataConflictKey(conflict);
    const side = choices.get(conflictKey);
    return side === undefined
      ? []
      : [{ conflict_key: conflictKey, side }];
  });
}

function requiredDateOrders(
  conflictCase: JigDataConflictCase,
  choices: ReadonlyMap<string, ReconciliationSide>,
): readonly JigDataDateOrder[] | null {
  return deriveJigDataDateOrders(
    conflictCase,
    choicesFor(conflictCase, choices),
  );
}

function stepFor(
  conflictCase: JigDataConflictCase,
  choices: ReadonlyMap<string, ReconciliationSide>,
  confirmedDates: ReadonlySet<string>,
): SyncConflictStep {
  const required = requiredDateOrders(conflictCase, choices);
  if (required === null) return "choices";
  return required.every((order) => confirmedDates.has(order.date))
    ? "confirm"
    : "order-review";
}

function sameTaskSet(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left.length !== right.length) return false;
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  return leftSorted.every(
    (taskId, index) => taskId === rightSorted[index],
  );
}

function seededDateOrders(
  required: readonly JigDataDateOrder[],
): ReadonlyMap<string, readonly string[]> {
  return new Map(
    required.map((order) => [order.date, order.task_ids] as const),
  );
}

export function createSyncConflictDraft(
  conflictCase: JigDataConflictCase,
): SyncConflictDraftState {
  return {
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
  conflictCase: JigDataConflictCase,
  state: SyncConflictDraftState,
  action: SyncConflictDraftAction,
): SyncConflictDraftState {
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

    case "set-date-order": {
      const required = requiredDateOrders(
        conflictCase,
        state.choices,
      );
      const expected = required?.find(
        (order) => order.date === action.date,
      );
      if (
        expected === undefined ||
        !sameTaskSet(expected.task_ids, action.task_ids)
      ) {
        return state;
      }
      const dateOrders = new Map(state.date_orders);
      dateOrders.set(action.date, [...action.task_ids]);
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
        !sameTaskSet(expected.task_ids, current)
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

export function syncConflictResolution(
  conflictCase: JigDataConflictCase,
  state: SyncConflictDraftState,
): JigDataResolution | null {
  const choices = choicesFor(conflictCase, state.choices);
  const required = deriveJigDataDateOrders(conflictCase, choices);
  if (
    required === null ||
    required.some(
      (order) => !state.confirmed_date_orders.has(order.date),
    )
  ) {
    return null;
  }

  const dateOrders: JigDataDateOrder[] = [];
  for (const requiredOrder of required) {
    const taskIds = state.date_orders.get(requiredOrder.date);
    if (taskIds === undefined) return null;
    dateOrders.push({
      date: requiredOrder.date,
      task_ids: taskIds,
    });
  }

  const resolution: JigDataResolution = {
    ancestor_head: conflictCase.ancestor_head,
    local_head: conflictCase.local_head,
    remote_head: conflictCase.remote_head,
    expected_revision: conflictCase.expected_revision,
    choices,
    date_orders: dateOrders,
  };
  return applyJigDataResolution(conflictCase, resolution).kind ===
    "resolved"
    ? resolution
    : null;
}
