import { Carousel, useSnapPaging } from "@astryxdesign/core";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";
import { addCivilDays, weekDates } from "../../src/core/planning";

// The strip rests on its middle slide with one week on either side. Paging to a
// neighbour is one week change; the strip is then re-centred on the new middle,
// which shows the same pixels the finger left, so no jump is visible.
const MIDDLE_PAGE = 1;
const WEEK_OFFSETS = [-7, 0, 7] as const;
// A native scroll reports no completion. The row is at rest when it has not
// scrolled for this long after the finger's snap has finished.
const SETTLE_DELAY_MS = 120;

export type WeekPagingDirection = "previous" | "next";

export interface WeekPagerProps {
  /** Monday of the displayed week. A change re-centres the strip. */
  readonly weekStart: string;
  readonly onCommit: (direction: WeekPagingDirection) => void;
  readonly renderWeek: (dates: readonly string[]) => ReactNode;
}

/**
 * The Carousel's scroll container is its first element child while the built-in
 * navigation buttons are off (Carousel anatomy: Scroll container, then Items).
 */
function scrollerElement(root: HTMLElement | null): HTMLElement | null {
  const child = root?.firstElementChild;
  return child instanceof HTMLElement ? child : null;
}

/** Put the strip back on its middle slide without animating the travel. */
function centreStrip(scroller: HTMLElement | null): void {
  if (scroller === null) {
    return;
  }
  const middle = scroller.clientWidth;
  if (middle <= 0 || Math.abs(scroller.scrollLeft - middle) <= 1) {
    return;
  }
  scroller.scrollLeft = middle;
}

/**
 * Narrow/mobile week paging over the public Astryx `Carousel`.
 *
 * The browser owns the gesture: native horizontal scrolling, its own touch
 * slop and axis lock, momentum, snapping, cancellation and interruption.
 * `useSnapPaging()` makes one flick move one view, so one gesture is at most
 * one week. Jig owns only which week is displayed and the strip's geometry.
 */
export function WeekPager({
  weekStart,
  onCommit,
  renderWeek,
}: WeekPagerProps): ReactElement {
  const paging = useSnapPaging();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const onCommitRef = useRef(onCommit);

  useLayoutEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  useEffect(() => {
    const root = rootRef.current;
    if (root === null) {
      return;
    }
    scrollerRef.current = scrollerElement(root);

    let settleTimer: number | undefined;
    const onScroll = (event: Event): void => {
      const target = event.target;
      if (target instanceof HTMLElement && target !== root) {
        scrollerRef.current = target;
      }
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        const scroller = scrollerRef.current;
        if (scroller === null) {
          return;
        }
        const pageWidth = scroller.clientWidth;
        if (pageWidth <= 0) {
          return;
        }
        const page = Math.round(scroller.scrollLeft / pageWidth);
        if (page === MIDDLE_PAGE) {
          return;
        }
        onCommitRef.current(page < MIDDLE_PAGE ? "previous" : "next");
      }, SETTLE_DELAY_MS);
    };

    root.addEventListener("scroll", onScroll, true);
    return () => {
      window.clearTimeout(settleTimer);
      root.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  // Mount, and every later week change (paging or the Previous/Next controls),
  // rests on the middle slide. Runs before paint so the strip never shows the
  // travel it was re-centred over.
  useLayoutEffect(() => {
    centreStrip(scrollerRef.current);
  }, [weekStart]);

  const slides = WEEK_OFFSETS.map((offset) =>
    weekDates(addCivilDays(weekStart, offset)),
  );

  return (
    <Carousel
      ref={rootRef}
      className="jig-week-pager"
      aria-label="Planner week"
      gap={0}
      hasSnap={paging}
      hasButtons={false}
      hasEdgeFade={false}
    >
      {slides.map((dates) => (
        <div className="jig-week-slide" key={dates[0]}>
          {renderWeek(dates)}
        </div>
      ))}
    </Carousel>
  );
}
