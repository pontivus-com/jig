#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

BASE_SHA = "f58e64459aa0aa534e8e5913eea8e9c277f3118b"


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"{path}: expected one match for replacement, found {count}"
        )
    path.write_text(text.replace(old, new))


def insert_before(path: Path, marker: str, addition: str) -> None:
    text = path.read_text()
    count = text.count(marker)
    if count != 1:
        raise SystemExit(f"{path}: expected one insertion marker, found {count}")
    path.write_text(text.replace(marker, addition + marker))


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: astryx-carousel-seam.py <astryx-checkout>")
    root = Path(sys.argv[1]).resolve()

    snap_value = root / "packages/core/src/SnapPaging/snapPagingValue.ts"
    replace_once(
        snap_value,
        """  readonly pages?: 'view' | 'item';
}
""",
        """  readonly pages?: 'view' | 'item';
  /**
   * Called after snap paging comes fully to rest on a page selected by a
   * gesture or programmatic paging move. Controlled internal alignment is
   * not reported. `index` and `previous` are page indexes in the configured
   * paging model.
   */
  readonly onSettle?: (index: number, previous: number) => void;
}
""",
    )
    insert_before(
        snap_value,
        "/** The paging attached to one row. */\n",
        """export interface SnapPagingMoveOptions {
  /** Animate the move. `false` repositions immediately. @default true */
  readonly animated?: boolean;
}

""",
    )
    replace_once(
        snap_value,
        """  readonly move: (target: (at: number, end: number) => number) => void;
""",
        """  readonly move: (
    target: (at: number, end: number) => number,
    options?: SnapPagingMoveOptions,
  ) => void;
""",
    )
    replace_once(
        snap_value,
        """export function moveSnapPaging(
  element: HTMLElement,
  target: (shown: number, end: number) => number,
): boolean {
  const attachment = attachments.get(element);
  if (attachment == null) {
    return false;
  }
  attachment.move(target);
  return true;
}
""",
        """export function moveSnapPaging(
  element: HTMLElement,
  target: (shown: number, end: number) => number,
  options?: SnapPagingMoveOptions,
): boolean {
  const attachment = attachments.get(element);
  if (attachment == null) {
    return false;
  }
  attachment.move(target, options);
  return true;
}
""",
    )

    snap = root / "packages/core/src/SnapPaging/SnapPaging.ts"
    replace_once(
        snap,
        """      get pages() {
        return optionsRef.current.pages;
      },
""",
        """      get pages() {
        return optionsRef.current.pages;
      },
      get onSettle() {
        return optionsRef.current.onSettle;
      },
""",
    )
    replace_once(
        snap,
        """      onSettle: () => {
        if (!pager.isDragging && !pager.isSettling) {
          track.handBack(
            isResnapDue
              ? () => {
                  isResnapDue = false;
                  skip(track.pages().skipped);
                }
              : undefined,
          );
        }
      },
""",
        """      onSettle: (index, previous) => {
        const isCurrentRest =
          !pager.isDragging && !pager.isSettling && index === pager.index;
        if (!pager.isDragging && !pager.isSettling) {
          track.handBack(
            isResnapDue
              ? () => {
                  isResnapDue = false;
                  skip(track.pages().skipped);
                }
              : undefined,
          );
        }
        if (isCurrentRest) {
          options.onSettle?.(index, previous);
        }
      },
""",
    )
    replace_once(
        snap,
        """    move: target => {
      // A finger on the row keeps it.
      if (pager.isDragging) {
        return;
      }
      // The target reads the row too, so every read comes before the
      // takeover's first write.
      const at = track.position();
      const end = track.travel();
      const to = Math.min(Math.max(target(at, end), 0), end);
      // A move from rest is the pager's own too. So a touch catches it as it
      // catches a settle, and the release rests on a page.
      if (!track.isMoving) {
        takeOverShown(at);
      }
      pager.goTo(pager.nearestPage(to), {offset: to});
    },
""",
        """    move: (target, moveOptions) => {
      // A finger on the row keeps it.
      if (pager.isDragging) {
        return;
      }
      // The target reads the row too, so every read comes before the
      // takeover's first write.
      const at = track.position();
      const end = track.travel();
      const to = Math.min(Math.max(target(at, end), 0), end);
      // A move from rest is the pager's own too. So a touch catches it as it
      // catches a settle, and the release rests on a page.
      if (!track.isMoving) {
        takeOverShown(at);
      }
      pager.goTo(pager.nearestPage(to), {
        offset: to,
        ...(moveOptions?.animated === undefined
          ? {}
          : {animated: moveOptions.animated}),
      });
    },
""",
    )

    carousel = root / "packages/core/src/Carousel/Carousel.tsx"
    insert_before(
        carousel,
        "/**\n * Imperative control surface for the Carousel",
        """export interface CarouselScrollToOptions {
  /**
   * Animate the move using Carousel's normal paging/scroll motion. `false`
   * repositions immediately while preserving Carousel-owned index geometry.
   * @default true
   */
  readonly animated?: boolean;
}

""",
    )
    replace_once(
        carousel,
        """  scrollTo(index: number): void;
""",
        """  scrollTo(index: number, options?: CarouselScrollToOptions): void;
""",
    )
    replace_once(
        carousel,
        """   * Imperative handle for programmatic scroll control. Exposes scrollNext,
   * scrollPrev, scrollTo, and the canScrollNext/canScrollPrev() queries.
""",
        """   * Imperative handle for programmatic scroll control. Exposes scrollNext,
   * scrollPrev, scrollTo (including immediate reposition), and the
   * canScrollNext/canScrollPrev queries.
""",
    )
    replace_once(
        carousel,
        """  const scrollToIndex = useCallback((index: number) => {
""",
        """  const scrollToIndex = useCallback((
    index: number,
    options?: CarouselScrollToOptions,
  ) => {
"",
    )
    replace_once(
        carousel,
        """        moveSnapPaging(el, (at, end) =>
          nearestStop(
            snapStops(el, at, end),
            at + (isRtlElement(el) ? -delta : delta),
          ),
        ),
""",
        """        moveSnapPaging(
          el,
          (at, end) =>
            nearestStop(
              snapStops(el, at, end),
              at + (isRtlElement(el) ? -delta : delta),
            ),
          options?.animated === undefined
            ? undefined
            : {animated: options.animated},
        ),
""",
    )
    replace_once(
        carousel,
        """    el.scrollBy({
      left: delta,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
  });
""",
        """
    el.scrollBy({
      left: delta,
      behavior:
        options?.animated === false
          ? 'instant'
          : prefersReducedMotion
            ? 'auto'
            : 'smooth',
    });
""",
    )
    replace_once(
        carousel,
        """      scrollTo: (index: number) => scrollToIndex(index),
""",
        """      scrollTo: (index: number, options?: CarouselScrollToOptions) =>
        scrollToIndex(index, options),
""",
    )

    carousel_index = root / "packages/core/src/Carousel/index.ts"
    replace_once(
        carousel_index,
        """export type {CarouselProps, CarouselHandle} from './Carousel';
""",
        """export type {
  CarouselProps,
  CarouselHandle,
  CarouselScrollToOptions,
} from './Carousel';
""",
    )

    carousel_doc = root / "packages/core/src/Carousel/Carousel.doc.mjs"
    replace_once(
        carousel_doc,
        """    {name: 'handleRef', type: 'React.Ref<CarouselHandle>', description: 'Imperative handle exposing scrollNext(), scrollPrev(), scrollTo(index), canScrollNext(), and canScrollPrev() for programmatic scroll control.'},
""",
        """    {name: 'handleRef', type: 'React.Ref<CarouselHandle>', description: 'Imperative handle exposing scrollNext(), scrollPrev(), scrollTo(index, {animated}), canScrollNext(), and canScrollPrev(). Pass animated: false to reposition immediately while retaining Carousel-owned paging geometry.'},
""",
    )
    replace_once(
        carousel_doc,
        """    handleRef: 'imperative handle: scrollNext/scrollPrev/scrollTo(index)/canScrollNext/canScrollPrev',
""",
        """    handleRef: 'imperative handle: scrollNext/scrollPrev/scrollTo(index, {animated})/canScrollNext/canScrollPrev; animated:false repositions immediately',
""",
    )

    snap_doc = root / "packages/core/src/SnapPaging/useSnapPaging.doc.mjs"
    replace_once(
        snap_doc,
        """      type: "{pages?: 'view' | 'item'}",
      description:
        "What one flick moves. 'view' moves one view and lands on the item start edge nearest one viewport on; 'item' moves one item. A new value applies from the next flick.",
      default: "{pages: 'view'}",
""",
        """      type: "{pages?: 'view' | 'item'; onSettle?: (index: number, previous: number) => void}",
      description:
        "What one flick moves, plus an optional callback after paging fully rests on a page chosen by a gesture or programmatic paging move. Controlled internal alignment is not reported. 'view' moves one view; 'item' moves one item.",
      default: "{pages: 'view'}",
""",
    )
    replace_once(
        snap_doc,
        """          "Pass {pages: 'item'} when several items show at once and each flick should move only one of them.",
""",
        """          "Pass {pages: 'item'} when several items show at once and each flick should move only one of them. Use onSettle when application state must advance only after that paging motion has actually come to rest.",
""",
    )
    replace_once(
        snap_doc,
        """      "{pages: 'view' | 'item'}: what one flick moves. Default 'view'. A new value applies from the next flick.",
""",
        """      "{pages: 'view' | 'item', onSettle}: what one flick moves and an optional final-rest callback. Default pages is 'view'.",
""",
    )

    carousel_test = root / "packages/core/src/Carousel/Carousel.test.tsx"
    insert_before(
        carousel_test,
        """    it('reports canScrollNext/canScrollPrev from live overflow state', () => {
""",
        """    it('scrollTo can force an immediate contained reposition', () => {
      const handle = createRef<CarouselHandle>();
      render(
        <Carousel handleRef={handle} aria-label="Handle">
          <div>Item 1</div>
          <div>Item 2</div>
        </Carousel>,
      );
      const scroller = getScroller();
      const scrollBy = vi.fn();
      scroller.scrollBy = scrollBy;

      handle.current?.scrollTo(1, {animated: false});
      ex