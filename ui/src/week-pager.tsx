import {
  Carousel,
  useSnapPaging,
  type CarouselHandle,
} from "@astryxdesign/core";
import {
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { addCivilDays, weekDates } from "../../src/core/planning";

const MIDDLE_PAGE = 1;
const WEEK_OFFSETS = [-7, 0, 7] as const;

export type WeekPagingDirection = "previous" | "next";

export interface WeekPagerHandle {
  readonly previous: () => void;
  readonly next: () => void;
  readonly restoreCurrent: () => void;
}

export interface WeekPagerProps {
  readonly weekStart: string;
  readonly handleRef?: Ref<WeekPagerHandle> | undefined;
  readonly isPagingDisabled: boolean;
  readonly onCommit: (direction: WeekPagingDirection) => void;
  readonly renderWeek: (
    dates: readonly string[],
    isActive: boolean,
  ) => ReactNode;
}

export function WeekPager({
  weekStart,
  handleRef,
  isPagingDisabled,
  onCommit,
  renderWeek,
}: WeekPagerProps): ReactElement {
  const carouselRef = useRef<CarouselHandle | null>(null);
  const committingRef = useRef(false);

  const snapPaging = useSnapPaging({
    pages: "item",
    onSettle: (index) => {
      if (
        isPagingDisabled ||
        committingRef.current ||
        index === MIDDLE_PAGE
      ) {
        return;
      }

      if (index !== 0 && index !== 2) {
        return;
      }

      committingRef.current = true;
      onCommit(index < MIDDLE_PAGE ? "previous" : "next");
    },
  });

  const restoreCurrent = useCallback((): void => {
    committingRef.current = false;
    carouselRef.current?.scrollTo(MIDDLE_PAGE, { animated: false });
  }, []);

  useImperativeHandle(
    handleRef,
    () => ({
      previous: () => {
        if (isPagingDisabled || committingRef.current) {
          return;
        }
        carouselRef.current?.scrollPrev();
      },
      next: () => {
        if (isPagingDisabled || committingRef.current) {
          return;
        }
        carouselRef.current?.scrollNext();
      },
      restoreCurrent,
    }),
    [isPagingDisabled, restoreCurrent],
  );

  useLayoutEffect(() => {
    restoreCurrent();
  }, [isPagingDisabled, restoreCurrent, weekStart]);

  const slides = WEEK_OFFSETS.map((offset) =>
    weekDates(addCivilDays(weekStart, offset)),
  );

  return (
    <Carousel
      aria-label="Planner week pager"
      className="jig-week-carousel"
      gap={0}
      hasButtons={false}
      hasEdgeFade={false}
      hasSnap={isPagingDisabled ? true : snapPaging}
      handleRef={carouselRef}
    >
      {slides.map((dates, index) => {
        const isActive = index === MIDDLE_PAGE;
        return (
          <div
            key={WEEK_OFFSETS[index]}
            className="jig-week-carousel-page"
            data-jig-week-page={isActive ? "active" : "passive"}
            aria-hidden={isActive ? undefined : true}
            inert={isActive ? undefined : true}
          >
            {renderWeek(dates, isActive)}
          </div>
        );
      })}
    </Carousel>
  );
}
