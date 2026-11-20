import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";
import { addCivilDays, weekDates } from "../../src/core/planning";

const MIDDLE_PAGE = 1;
const WEEK_OFFSETS = [-7, 0, 7] as const;

export type WeekPagingDirection = "previous" | "next";

export interface WeekPagingRequest {
  readonly id: number;
  readonly direction: WeekPagingDirection;
}

export interface WeekPagerProps {
  readonly weekStart: string;
  readonly navigationRequest: WeekPagingRequest | null;
  readonly isPagingDisabled: boolean;
  readonly onCommit: (direction: WeekPagingDirection) => void;
  readonly renderWeek: (
    dates: readonly string[],
    isActive: boolean,
  ) => ReactNode;
}

function centerStrip(scroller: HTMLDivElement | null): void {
  if (scroller === null || scroller.clientWidth <= 0) {
    return;
  }
  const middle = scroller.clientWidth * MIDDLE_PAGE;
  if (Math.abs(scroller.scrollLeft - middle) <= 1) {
    return;
  }
  scroller.scrollTo({ left: middle, behavior: "auto" });
}

function pageFor(scroller: HTMLDivElement): number | null {
  if (scroller.clientWidth <= 0) {
    return null;
  }
  return Math.round(scroller.scrollLeft / scroller.clientWidth);
}

export function WeekPager({
  weekStart,
  navigationRequest,
  isPagingDisabled,
  onCommit,
  renderWeek,
}: WeekPagerProps): ReactElement {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const onCommitRef = useRef(onCommit);
  const pagingDisabledRef = useRef(isPagingDisabled);
  const committingRef = useRef(false);
  const processedRequestRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    onCommitRef.current = onCommit;
    pagingDisabledRef.current = isPagingDisabled;
  }, [isPagingDisabled, onCommit]);

  const commitSettledPageRef = useRef<(scroller: HTMLDivElement) => void>(
    () => undefined,
  );
  commitSettledPageRef.current = (scroller) => {
    if (pagingDisabledRef.current || committingRef.current) {
      return;
    }
    const page = pageFor(scroller);
    if (page === null || page === MIDDLE_PAGE) {
      return;
    }
    committingRef.current = true;
    onCommitRef.current(page < MIDDLE_PAGE ? "previous" : "next");
  };

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller === null) {
      return;
    }
    const onScrollEnd = (): void => {
      commitSettledPageRef.current(scroller);
    };
    scroller.addEventListener("scrollend", onScrollEnd);
    return () => scroller.removeEventListener("scrollend", onScrollEnd);
  }, []);

  useLayoutEffect(() => {
    committingRef.current = false;
    centerStrip(scrollerRef.current);
  }, [weekStart]);

  useEffect(() => {
    const onResize = (): void => centerStrip(scrollerRef.current);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (isPagingDisabled) {
      centerStrip(scrollerRef.current);
    }
  }, [isPagingDisabled]);

  useEffect(() => {
    if (
      navigationRequest === null ||
      isPagingDisabled ||
      processedRequestRef.current === navigationRequest.id
    ) {
      return;
    }
    const scroller = scrollerRef.current;
    if (scroller === null || scroller.clientWidth <= 0) {
      return;
    }

    processedRequestRef.current = navigationRequest.id;
    const target =
      navigationRequest.direction === "previous"
        ? 0
        : scroller.clientWidth * 2;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    scroller.scrollTo({
      left: target,
      behavior: reduceMotion ? "auto" : "smooth",
    });

    if (!reduceMotion) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      commitSettledPageRef.current(scroller);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isPagingDisabled, navigationRequest]);

  const slides = WEEK_OFFSETS.map((offset) =>
    weekDates(addCivilDays(weekStart, offset)),
  );

  return (
    <div
      ref={scrollerRef}
      className="jig-week-pager"
      aria-label="Planner week pager"
      data-jig-paging-disabled={isPagingDisabled ? "true" : "false"}
    >
      {slides.map((dates, index) => {
        const isActive = index === MIDDLE_PAGE;
        return (
          <div
            key={dates[0]}
            className="jig-week-slide"
            data-jig-week-page={isActive ? "active" : "preview"}
            aria-hidden={isActive ? undefined : true}
            inert={isActive ? undefined : true}
          >
            {renderWeek(dates, isActive)}
          </div>
        );
      })}
    </div>
  );
}
