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
  useState,
  type Ref,
} from "react";
import type { RecurrenceSeries } from "../../src/core/recurrence";
import type { Priority, Task } from "../../src/core/task";
import { addCivilDays, weekDates } from "../../src/core/planning";
import { todayCivilDate } from "./dates";
import { TaskDragProvider } from "./drag";
import {
  WeekPage,
  type CanonicalWeekCapabilities,
  type WeekTransitionDirection,
} from "./week";

const MIDDLE_SLIDE_INDEX = 1;

export interface WeekCarouselHandle {
  movePrevious(): boolean;
  moveNext(): boolean;
  recenter(): void;
}

export interface WeekCarouselProps {
  readonly handleRef: Ref<WeekCarouselHandle>;
  readonly focusCurrentDayOnMount: boolean;
  readonly todayScrollRequest: number;
  readonly weekTransitionDirection: WeekTransitionDirection | null;
  readonly displayedWeekStart: string;
  readonly tasks: readonly Task[];
  readonly recurrences: readonly RecurrenceSeries[];
  readonly now: Date;
  readonly selectedTask: Task | null;
  readonly onSelectTask: (task: Task) => void;
  readonly onAdd: (date: string) => void;
  readonly onEdit: (task: Task) => void;
  readonly onToggleComplete: (task: Task) => Promise<boolean>;
  readonly onSetPriority: (task: Task, priority: Priority) => Promise<boolean>;
  readonly onDelete: (task: Task) => void;
  readonly onMove: (
    taskId: string,
    destinationDate: string,
    destinationIndex: number,
  ) => Promise<boolean>;
  readonly onShiftWeek: (direction: -1 | 1) => void;
}

export function WeekCarousel(
  props: WeekCarouselProps,
): React.ReactElement {
  const carouselRef = useRef<CarouselHandle>(null);
  const todaySectionRef = useRef<HTMLDivElement>(null);
  const dragActiveRef = useRef(false);
  const [isTaskDragActive, setIsTaskDragActive] = useState(false);
  const committedWeekStartRef = useRef<string | null>(null);

  const recenter = useCallback((): void => {
    carouselRef.current?.scrollTo(MIDDLE_SLIDE_INDEX, {
      animated: false,
    });
  }, []);

  const onSettle = useCallback(
    (index: number): void => {
      if (index === MIDDLE_SLIDE_INDEX) {
        return;
      }

      if (dragActiveRef.current) {
        recenter();
        return;
      }

      if (committedWeekStartRef.current === props.displayedWeekStart) {
        return;
      }

      if (index !== 0 && index !== 2) {
        recenter();
        return;
      }

      committedWeekStartRef.current = props.displayedWeekStart;
      props.onShiftWeek(index === 0 ? -1 : 1);
    },
    [props.displayedWeekStart, props.onShiftWeek, recenter],
  );

  const snapPaging = useSnapPaging({
    pages: "item",
    onSettle,
  });

  useLayoutEffect(() => {
    committedWeekStartRef.current = null;
    recenter();
  }, [props.displayedWeekStart, recenter]);

  const moveTo = useCallback((index: 0 | 2): boolean => {
    if (dragActiveRef.current) {
      return false;
    }
    carouselRef.current?.scrollTo(index);
    return carouselRef.current !== null;
  }, []);

  useImperativeHandle(
    props.handleRef,
    () => ({
      movePrevious: () => moveTo(0),
      moveNext: () => moveTo(2),
      recenter,
    }),
    [moveTo, recenter],
  );

  const today = todayCivilDate();
  const currentDates = weekDates(props.displayedWeekStart);
  const displayedWeekKey = currentDates.join("|");

  useLayoutEffect(() => {
    if (
      !props.focusCurrentDayOnMount ||
      !currentDates.includes(today)
    ) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      todaySectionRef.current?.scrollIntoView({
        block: "start",
        inline: "nearest",
        behavior: "auto",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [displayedWeekKey, props.focusCurrentDayOnMount, today]);

  useLayoutEffect(() => {
    if (
      props.todayScrollRequest === 0 ||
      !currentDates.includes(today)
    ) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      todaySectionRef.current?.scrollIntoView({
        block: "start",
        inline: "nearest",
        behavior: "auto",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [displayedWeekKey, props.todayScrollRequest, today]);

  const handleDragActiveChange = useCallback(
    (active: boolean): void => {
      dragActiveRef.current = active;
      setIsTaskDragActive(active);
      if (active) {
        committedWeekStartRef.current = props.displayedWeekStart;
      } else {
        committedWeekStartRef.current = null;
      }
    },
    [props.displayedWeekStart],
  );

  const canonicalCapabilities: CanonicalWeekCapabilities = {
    kind: "canonical",
    onSelectTask: props.onSelectTask,
    onAdd: props.onAdd,
    onEdit: props.onEdit,
    onToggleComplete: props.onToggleComplete,
    onSetPriority: props.onSetPriority,
    onDelete: props.onDelete,
    onMove: props.onMove,
  };

  const logicalWeeks = [
    addCivilDays(props.displayedWeekStart, -7),
    props.displayedWeekStart,
    addCivilDays(props.displayedWeekStart, 7),
  ] as const;

  return (
    <TaskDragProvider
      tasks={props.tasks}
      onMove={props.onMove}
      onDragActiveChange={handleDragActiveChange}
    >
      <Carousel
        handleRef={carouselRef}
        hasSnap={snapPaging}
        scrollingBehavior={isTaskDragActive ? "suspended" : "enabled"}
        hasButtons={false}
        hasEdgeFade={false}
        itemWidth="view"
        gap={0}
        aria-label="Planner weeks"
        className="jig-week-carousel"
      >
      {logicalWeeks.map((weekStart, index) => {
        const isCanonical = index === MIDDLE_SLIDE_INDEX;
        return (
          <div
            key={weekStart}
            className="jig-week-carousel-slide"
            data-jig-week-canonical={isCanonical ? "true" : "false"}
            {...(isCanonical
              ? {}
              : {
                  inert: true,
                  "aria-hidden": true,
                })}
          >
            <WeekPage
              dates={weekDates(weekStart)}
              selectedTask={props.selectedTask}
              transition={
                isCanonical ? props.weekTransitionDirection : null
              }
              todaySectionRef={
                isCanonical ? todaySectionRef : undefined
              }
              tasks={props.tasks}
              recurrences={props.recurrences}
              now={props.now}
              capabilities={
                isCanonical
                  ? canonicalCapabilities
                  : { kind: "adjacent" }
              }
            />
          </div>
        );
      })}
      </Carousel>
    </TaskDragProvider>
  );
}
