#!/usr/bin/env python3
from pathlib import Path
import sys

BASE_SHA = "f58e64459aa0aa534e8e5913eea8e9c277f3118b"

def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected 1 match, found {count}")
    path.write_text(text.replace(old, new))

def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: astryx-carousel-seam.py <astryx-checkout>")
    root = Path(sys.argv[1]).resolve()

    value = root / "packages/core/src/SnapPaging/snapPagingValue.ts"
    replace_once(
        value,
        "  readonly pages?: 'view' | 'item';\n}",
        "  readonly pages?: 'view' | 'item';\n"
        "  /** Called after paging fully rests on a page selected by a gesture or programmatic move. */\n"
        "  readonly onSettle?: (index: number, previous: number) => void;\n"
        "}",
    )
    replace_once(
        value,
        "/** The paging attached to one row. */\nexport interface SnapPagingAttachment {",
        "export interface SnapPagingMoveOptions {\n"
        "  /** Animate the move. false repositions immediately. @default true */\n"
        "  readonly animated?: boolean;\n"
        "}\n\n"
        "/** The paging attached to one row. */\nexport interface SnapPagingAttachment {",
    )
    replace_once(
        value,
        "  readonly move: (target: (at: number, end: number) => number) => void;",
        "  readonly move: (\n"
        "    target: (at: number, end: number) => number,\n"
        "    options?: SnapPagingMoveOptions,\n"
        "  ) => void;",
    )
    replace_once(
        value,
        "export function moveSnapPaging(\n"
        "  element: HTMLElement,\n"
        "  target: (shown: number, end: number) => number,\n"
        "): boolean {\n"
        "  const attachment = attachments.get(element);\n"
        "  if (attachment == null) {\n"
        "    return false;\n"
        "  }\n"
        "  attachment.move(target);\n"
        "  return true;\n"
        "}",
        "export function moveSnapPaging(\n"
        "  element: HTMLElement,\n"
        "  target: (shown: number, end: number) => number,\n"
        "  options?: SnapPagingMoveOptions,\n"
        "): boolean {\n"
        "  const attachment = attachments.get(element);\n"
        "  if (attachment == null) {\n"
        "    return false;\n"
        "  }\n"
        "  attachment.move(target, options);\n"
        "  return true;\n"
        "}",
    )

    snap = root / "packages/core/src/SnapPaging/SnapPaging.ts"
    replace_once(
        snap,
        "      get pages() {\n"
        "        return optionsRef.current.pages;\n"
        "      },\n",
        "      get pages() {\n"
        "        return optionsRef.current.pages;\n"
        "      },\n"
        "      get onSettle() {\n"
        "        return optionsRef.current.onSettle;\n"
        "      },\n",
    )
    replace_once(
        snap,
        "  const pager = createPager(\n",
        "  let shouldReportSettle = false;\n"
        "  const pager = createPager(\n",
    )
    replace_once(
        snap,
        "      onSettle: () => {\n"
        "        if (!pager.isDragging && !pager.isSettling) {\n"
        "          track.handBack(\n"
        "            isResnapDue\n"
        "              ? () => {\n"
        "                  isResnapDue = false;\n"
        "                  skip(track.pages().skipped);\n"
        "                }\n"
        "              : undefined,\n"
        "          );\n"
        "        }\n"
        "      },",
        "      onIndexChange: () => {\n"
        "        shouldReportSettle = true;\n"
        "      },\n"
        "      onSettle: (index, previous) => {\n"
        "        const isCurrentRest =\n"
        "          !pager.isDragging && !pager.isSettling && index === pager.index;\n"
        "        if (!pager.isDragging && !pager.isSettling) {\n"
        "          track.handBack(\n"
        "            isResnapDue\n"
        "              ? () => {\n"
        "                  isResnapDue = false;\n"
        "                  skip(track.pages().skipped);\n"
        "                }\n"
        "              : undefined,\n"
        "          );\n"
        "        }\n"
        "        if (isCurrentRest && shouldReportSettle) {\n"
        "          shouldReportSettle = false;\n"
        "          options.onSettle?.(index, previous);\n"
        "        }\n"
        "      },",
    )
    replace_once(
        snap,
        "    move: target => {\n"
        "      // A finger on the row keeps it.\n"
        "      if (pager.isDragging) {\n"
        "        return;\n"
        "      }\n"
        "      // The target reads the row too, so every read comes before the\n"
        "      // takeover's first write.\n"
        "      const at = track.position();\n"
        "      const end = track.travel();\n"
        "      const to = Math.min(Math.max(target(at, end), 0), end);\n"
        "      // A move from rest is the pager's own too. So a touch catches it as it\n"
        "      // catches a settle, and the release rests on a page.\n"
        "      if (!track.isMoving) {\n"
        "        takeOverShown(at);\n"
        "      }\n"
        "      pager.goTo(pager.nearestPage(to), {offset: to});\n"
        "    },",
        "    move: (target, moveOptions) => {\n"
        "      // A finger on the row keeps it.\n"
        "      if (pager.isDragging) {\n"
        "        return;\n"
        "      }\n"
        "      // The target reads the row too, so every read comes before the\n"
        "      // takeover's first write.\n"
        "      const at = track.position();\n"
        "      const end = track.travel();\n"
        "      const to = Math.min(Math.max(target(at, end), 0), end);\n"
        "      // A move from rest is the pager's own too. So a touch catches it as it\n"
        "      // catches a settle, and the release rests on a page.\n"
        "      if (!track.isMoving) {\n"
        "        takeOverShown(at);\n"
        "      }\n"
        "      pager.goTo(pager.nearestPage(to), {\n"
        "        offset: to,\n"
        "        ...(moveOptions?.animated === undefined\n"
        "          ? {}\n"
        "          : {animated: moveOptions.animated}),\n"
        "      });\n"
        "    },",
    )

    carousel = root / "packages/core/src/Carousel/Carousel.tsx"
    replace_once(
        carousel,
        "registerEnglishFallback(english);\n/**\n * Imperative control surface for the Carousel",
        "registerEnglishFallback(english);\n\n"
        "export interface CarouselScrollToOptions {\n"
        "  /** Animate the move. false repositions immediately. @default true */\n"
        "  readonly animated?: boolean;\n"
        "}\n\n"
        "/**\n * Imperative control surface for the Carousel",
    )
    replace_once(
        carousel,
        "  scrollTo(index: number): void;",
        "  scrollTo(index: number, options?: CarouselScrollToOptions): void;",
    )
    replace_once(
        carousel,
        "  const scrollToIndex = useCallback((index: number) => {",
        "  const scrollToIndex = useCallback((\n"
        "    index: number,\n"
        "    options?: CarouselScrollToOptions,\n"
        "  ) => {",
    )
    replace_once(
        carousel,
        "        moveSnapPaging(el, (at, end) =>\n"
        "          nearestStop(\n"
        "            snapStops(el, at, end),\n"
        "            at + (isRtlElement(el) ? -delta : delta),\n"
        "          ),\n"
        "        ),",
        "        moveSnapPaging(\n"
        "          el,\n"
        "          (at, end) =>\n"
        "            nearestStop(\n"
        "              snapStops(el, at, end),\n"
        "              at + (isRtlElement(el) ? -delta : delta),\n"
        "            ),\n"
        "          options?.animated === undefined\n"
        "            ? undefined\n"
        "            : {animated: options.animated},\n"
        "        ),",
    )
    replace_once(
        carousel,
        "    el.scrollBy({\n"
        "      left: delta,\n"
        "      behavior: prefersReducedMotion ? 'auto' : 'smooth',\n"
        "    });",
        "    el.scrollBy({\n"
        "      left: delta,\n"
        "      behavior:\n"
        "        options?.animated === false\n"
        "          ? 'instant'\n"
        "          : prefersReducedMotion\n"
        "            ? 'auto'\n"
        "            : 'smooth',\n"
        "    });",
    )
    replace_once(
        carousel,
        "      scrollTo: (index: number) => scrollToIndex(index),",
        "      scrollTo: (index: number, options?: CarouselScrollToOptions) =>\n"
        "        scrollToIndex(index, options),",
    )

    index = root / "packages/core/src/Carousel/index.ts"
    replace_once(
        index,
        "export type {CarouselProps, CarouselHandle} from './Carousel';",
        "export type {\n"
        "  CarouselProps,\n"
        "  CarouselHandle,\n"
        "  CarouselScrollToOptions,\n"
        "} from './Carousel';",
    )

    carousel_test = root / "packages/core/src/Carousel/Carousel.test.tsx"
    replace_once(
        carousel_test,
        "    it('scrollTo scrolls the container and clamps out-of-range indices', () => {",
        "    it('scrollTo can force an immediate contained reposition', () => {\n"
        "      const handle = createRef<CarouselHandle>();\n"
        "      render(\n"
        "        <Carousel handleRef={handle} aria-label=\"Handle\">\n"
        "          <div>Item 1</div>\n"
        "          <div>Item 2</div>\n"
        "        </Carousel>,\n"
        "      );\n"
        "      const scroller = getScroller();\n"
        "      const scrollBy = vi.fn();\n"
        "      scroller.scrollBy = scrollBy;\n\n"
        "      handle.current?.scrollTo(1, {animated: false});\n"
        "      expect(scrollBy).toHaveBeenCalledWith(\n"
        "        expect.objectContaining({behavior: 'instant'}),\n"
        "      );\n"
        "    });\n\n"
        "    it('scrollTo scrolls the container and clamps out-of-range indices', () => {",
    )

    snap_test = root / "packages/core/src/SnapPaging/SnapPaging.test.tsx"
    replace_once(
        snap_test,
        "    it('moves the row through the paging for a scroll to an item', () => {",
        "    it('forwards immediate scrollTo intent through snap paging', () => {\n"
        "      let animated: boolean | undefined;\n"
        "      const value = makeSnapPaging(() => ({\n"
        "        ...attachment(),\n"
        "        move: (_target, options) => {\n"
        "          animated = options?.animated;\n"
        "        },\n"
        "      }));\n"
        "      const handle = createRef<CarouselHandle>();\n"
        "      render(\n"
        "        <Carousel aria-label=\"Items\" hasSnap={value} handleRef={handle}>\n"
        "          <div>One</div>\n"
        "          <div>Two</div>\n"
        "        </Carousel>,\n"
        "      );\n"
        "      act(() => handle.current?.scrollTo(1, {animated: false}));\n"
        "      expect(animated).toBe(false);\n"
        "    });\n\n"
        "    it('reports the final rest after a programmatic paging move', () => {\n"
        "      const settles: Array<[number, number]> = [];\n"
        "      const handle = createRef<CarouselHandle>();\n"
        "      function Paging() {\n"
        "        return (\n"
        "          <Carousel\n"
        "            aria-label=\"Items\"\n"
        "            hasSnap={useSnapPaging({\n"
        "              pages: 'item',\n"
        "              onSettle: (index, previous) => settles.push([index, previous]),\n"
        "            })}\n"
        "            handleRef={handle}\n"
        "          >\n"
        "            <div>One</div>\n"
        "            <div>Two</div>\n"
        "            <div>Three</div>\n"
        "          </Carousel>\n"
        "        );\n"
        "      }\n"
        "      render(<Paging />);\n"
        "      const row = scroller();\n"
        "      Object.defineProperty(row, 'clientWidth', {value: 100, configurable: true});\n"
        "      Object.defineProperty(row, 'offsetWidth', {value: 100, configurable: true});\n"
        "      Object.defineProperty(row, 'scrollWidth', {value: 300, configurable: true});\n"
        "      Object.defineProperty(row, 'scrollLeft', {\n"
        "        value: 0,\n"
        "        writable: true,\n"
        "        configurable: true,\n"
        "      });\n"
        "      row.getBoundingClientRect = () => new DOMRect(0, 0, 100, 100);\n"
        "      Array.from(row.children).forEach((child, index) => {\n"
        "        child.getBoundingClientRect = () =>\n"
        "          new DOMRect(index * 100, 0, 100, 100);\n"
        "      });\n"
        "      row.scrollTo = ({left}: ScrollToOptions) => {\n"
        "        if (typeof left === 'number') row.scrollLeft = left;\n"
        "      };\n\n"
        "      act(() => handle.current?.scrollTo(1, {animated: false}));\n"
        "      expect(settles).toEqual([[1, 0]]);\n"
        "    });\n\n"
        "    it('moves the row through the paging for a scroll to an item', () => {",
    )

    carousel_doc = root / "packages/core/src/Carousel/Carousel.doc.mjs"
    replace_once(
        carousel_doc,
        "    {name: 'handleRef', type: 'React.Ref<CarouselHandle>', description: 'Imperative handle exposing scrollNext(), scrollPrev(), scrollTo(index), canScrollNext(), and canScrollPrev() for programmatic scroll control.'},",
        "    {name: 'handleRef', type: 'React.Ref<CarouselHandle>', description: 'Imperative handle exposing scrollNext(), scrollPrev(), scrollTo(index, {animated}), canScrollNext(), and canScrollPrev(). Pass animated: false to reposition immediately.'},",
    )
    replace_once(
        carousel_doc,
        "    handleRef: 'imperative handle: scrollNext/scrollPrev/scrollTo(index)/canScrollNext/canScrollPrev',",
        "    handleRef: 'imperative handle: scrollNext/scrollPrev/scrollTo(index, {animated})/canScrollNext/canScrollPrev; animated:false repositions immediately',",
    )

    snap_doc = root / "packages/core/src/SnapPaging/useSnapPaging.doc.mjs"
    replace_once(
        snap_doc,
        "      type: \"{pages?: 'view' | 'item'}\",",
        "      type: \"{pages?: 'view' | 'item'; onSettle?: (index: number, previous: number) => void}\",",
    )
    replace_once(
        snap_doc,
        "        \"What one flick moves. 'view' moves one view and lands on the item start edge nearest one viewport on; 'item' moves one item. A new value applies from the next flick.\",",
        "        \"What one flick moves, plus an optional callback after paging fully rests on a page selected by a gesture or programmatic move. Controlled internal alignment is not reported.\",",
    )
    replace_once(
        snap_doc,
        "      \"{pages: 'view' | 'item'}: what one flick moves. Default 'view'. A new value applies from the next flick.\",",
        "      \"{pages: 'view' | 'item', onSettle}: what one flick moves and an optional final-rest callback. Default pages is 'view'.\",",
    )

    changeset = root / ".changeset/carousel-settled-reposition.md"
    changeset.write_text(
        "---\n"
        "'@astryxdesign/core': patch\n"
        "---\n\n"
        "[feature] Carousel snap paging can report its final settled page, and "
        "CarouselHandle.scrollTo can reposition without animation.\n\n"
        "@rpstreef\n"
    )

    print(f"Applied Astryx Carousel lifecycle seam to {root}")
    print(f"Expected base: {BASE_SHA}")

if __name__ == "__main__":
    main()
