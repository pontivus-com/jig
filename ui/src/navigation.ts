import type { Destination } from "./destinations";

export interface DestinationNavigationState {
  readonly current: Destination;
  readonly history: readonly Destination[];
}

export const initialDestinationNavigation: DestinationNavigationState = {
  current: "planner",
  history: [],
};

export function navigateDestination(
  state: DestinationNavigationState,
  next: Destination,
): DestinationNavigationState {
  if (state.current === next) {
    return state;
  }

  return {
    current: next,
    history: [...state.history, state.current],
  };
}

export function previousDestination(
  state: DestinationNavigationState,
): DestinationNavigationState | null {
  const previous = state.history.at(-1);
  if (previous === undefined) {
    return null;
  }

  return {
    current: previous,
    history: state.history.slice(0, -1),
  };
}
