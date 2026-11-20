import {
  usePanGesture,
  type PanGestureEvent,
} from "@astryxdesign/core";
import { useCallback, useEffect, useRef, type PointerEventHandler } from "react";
import type { RefObject } from "react";

// Jig's deliberate-intent threshold. Astryx owns recognition (slop, axis,
// cancellation); these values decide whether a completed pan is a week
// change or an ordinary short drag.
const MIN_SWIPE_DISTANCE = 48;
const MIN_FLING_DISTANCE = 24;
const MIN_FLING_VELOCITY = 500;

export interface WeekSwipeHandlers {
  readonly boardRef: RefObject<HTMLDivElement | null>;
  readonly onPointerDownCapture: PointerEventHandler<HTMLDivElement>;
}

interface WeekSwipeOptions {
  readonly enabled: boolean;
  readonly onSwipeLeft: () => void;
  readonly onSwipeRight: () => void;
}

function isExcludedTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(
      "button, a, input, textarea, select, [role=button], " +
        "[data-jig-drag-excluded], .jig-task-card, .jig-task-drag-handle",
    ) !== null
  );
}

function isDeliberateSwipe(event: PanGestureEvent): boolean {
  const distance = Math.abs(event.translation.x);
  const velocity = Math.abs(event.velocity.x);
  return (
    distance >= MIN_SWIPE_DISTANCE ||
    (distance >= MIN_FLING_DISTANCE && velocity >= MIN_FLING_VELOCITY)
  );
}

export function useWeekSwipe({
  enabled,
  onSwipeLeft,
  onSwipeRight,
}: WeekSwipeOptions): WeekSwipeHandlers {
  const boardRef = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onSwipeLeft, onSwipeRight });
  const eligibleGesture = useRef<boolean | null>(null);

  useEffect(() => {
    callbacks.current = { onSwipeLeft, onSwipeRight };
  }, [onSwipeLeft, onSwipeRight]);

  const onPan = useCallback((event: PanGestureEvent): void => {
    if (event.state === "began") {
      return;
    }

    if (event.state === "cancelled") {
      eligibleGesture.current = null;
      return;
    }

    if (event.state !== "ended") {
      return;
    }

    const eligible = eligibleGesture.current;
    eligibleGesture.current = null;
    if (eligible !== true || !isDeliberateSwipe(event)) {
      return;
    }

    if (event.translation.x < 0) {
      callbacks.current.onSwipeLeft();
    } else {
      callbacks.current.onSwipeRight();
    }
  }, []);

  usePanGesture(boardRef, {
    axis: "x",
    onPan,
  });

  useEffect(() => {
    if (!enabled) {
      eligibleGesture.current = null;
    }
  }, [enabled]);

  const onPointerDownCapture = useCallback<
    PointerEventHandler<HTMLDivElement>
  >(
    (event) => {
      if (!event.isPrimary) {
        return;
      }

      // Every primary press rewrites eligibility, so a tap that never became
      // a pan cannot leave a stale `true` for a later mouse/pen drag.
      eligibleGesture.current =
        enabled &&
        event.pointerType === "touch" &&
        !isExcludedTarget(event.target);
    },
    [enabled],
  );

  return { boardRef, onPointerDownCapture };
}
