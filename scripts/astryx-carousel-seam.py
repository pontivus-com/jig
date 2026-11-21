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
        "  /** Carousel items — rendered in a horizontal scroll container. */\n"
        "  children: ReactNode;\n",
        "  /** Carousel items — rendered in a horizontal scroll container. */\n"
        "  children: ReactNode;\n"
        "  /**\n"
        "   * Width owned by each Carousel slide wrapper. 'view' makes every\n"
        "   * slide exactly one Carousel scroll viewport wide; 'content' leaves\n"
        "   * width to the child content.\n"
        "   * @default 'content'\n"
        "   */\n"
        "  itemWidth?: 'content' | 'view';\n"
        "  /** User-originated horizontal scrolling and paging. @default 'enabled' */\n"
        "  scrollingBehavior?: 'enabled' | 'suspended';\n",
    )
    replace_once(
        carousel,
        "  children,\n"
        "  gap = 1,",
        "  children,\n"
        "  itemWidth = 'content',\n"
        "  scrollingBehavior = 'enabled',\n"
        "  gap = 1,",
    )
    replace_once(
        carousel,
        "  const snapPaging = isSnapPaging(hasSnap) ? hasSnap : null;\n"
        "  const isPaging = snapPaging != null;\n"
        "  const [attachedPaging, setAttachedPaging] = useState(snapPaging);\n"
        "  if ((attachedPaging != null) !== isPaging) {\n"
        "    setAttachedPaging(snapPaging);\n"
        "  }",
        "  const snapPaging = isSnapPaging(hasSnap) ? hasSnap : null;\n"
        "  const isPaging = snapPaging != null;\n"
        "  const isScrollingEnabled = scrollingBehavior === 'enabled';\n"
        "  const shouldAttachPaging = isPaging && isScrollingEnabled;\n"
        "  const [attachedPaging, setAttachedPaging] = useState(\n"
        "    shouldAttachPaging ? snapPaging : null,\n"
        "  );\n"
        "  if ((attachedPaging != null) !== shouldAttachPaging) {\n"
        "    setAttachedPaging(shouldAttachPaging ? snapPaging : null);\n"
        "  }",
    )
    replace_once(
        carousel,
        "        const delta = event.deltaX || (event.shiftKey ? event.deltaY : 0);\n"
        "        if (\n",
        "        const delta = event.deltaX || (event.shiftKey ? event.deltaY : 0);\n"
        "        if (!isScrollingEnabled) {\n"
        "          if (delta !== 0) {\n"
        "            event.preventDefault();\n"
        "            event.stopPropagation();\n"
        "          }\n"
        "          return;\n"
        "        }\n"
        "        if (\n",
    )
    replace_once(
        carousel,
        "    hasOverflow,\n"
        "  );\n\n"
        "  const scrollBy",
        "    hasOverflow\n"
        "      ? isScrollingEnabled\n"
        "        ? 'overflow-enabled'\n"
        "        : 'overflow-suspended'\n"
        "      : 'fit',\n"
        "  );\n\n"
        "  const scrollBy",
    )
    replace_once(
        carousel,
        "  const canScrollStart = hasLoop && hasOverflow ? true : overflowStart;\n"
        "  const canScrollEnd = hasLoop && hasOverflow ? true : overflowEnd;",
        "  const canScrollStart =\n"
        "    isScrollingEnabled && (hasLoop && hasOverflow ? true : overflowStart);\n"
        "  const canScrollEnd =\n"
        "    isScrollingEnabled && (hasLoop && hasOverflow ? true : overflowEnd);",
    )
    replace_once(
        carousel,
        "        tabIndex={hasOverflow ? 0 : -1}",
        "        tabIndex={hasOverflow && isScrollingEnabled ? 0 : -1}",
    )
    replace_once(
        carousel,
        "  item: {\n"
        "    scrollSnapAlign: 'start',\n"
        "    display: 'flex',\n"
        "    flexShrink: 0,\n"
        "  },",
        "  item: {\n"
        "    scrollSnapAlign: 'start',\n"
        "    display: 'flex',\n"
        "    flexShrink: 0,\n"
        "  },\n"
        "  itemView: {\n"
        "    width: '100%',\n"
        "    minWidth: 0,\n"
        "    flexBasis: '100%',\n"
        "  },",
    )
    replace_once(
        carousel,
        "    scrollbarWidth: 'none',\n"
        "    maskImage: 'none',\n"
        "  },\n"
        "  fadeStart:",
        "    scrollbarWidth: 'none',\n"
        "    maskImage: 'none',\n"
        "  },\n"
        "  scrollerView: {\n"
        "    width: '100%',\n"
        "    minWidth: 0,\n"
        "  },\n"
        "  scrollerLocked: {\n"
        "    overflowX: 'hidden',\n"
        "  },\n"
        "  fadeStart:",
    )
    replace_once(
        carousel,
        "            styles.scroller,\n"
        "            // A tab stop whose shared ring the root paints.",
        "            styles.scroller,\n"
        "            itemWidth === 'view' && styles.scrollerView,\n"
        "            !isScrollingEnabled && styles.scrollerLocked,\n"
        "            // A tab stop whose shared ring the root paints.",
    )
    replace_once(
        carousel,
        "            {...stylex.props(styles.item)}>",
        "            {...stylex.props(\n"
        "              styles.item,\n"
        "              itemWidth === 'view' && styles.itemView,\n"
        "            )}>",
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
        "  it('exposes each slide as a group with aria-roledescription=\"slide\" and a positional name', () => {",
        "  it('can size each public slide wrapper to one Carousel view', () => {\n"
        "    const {rerender} = render(\n"
        "      <Carousel itemWidth=\"view\" aria-label=\"Paged\">\n"
        "        <div>One</div>\n"
        "        <div>Two</div>\n"
        "      </Carousel>,\n"
        "    );\n"
        "    const viewSlides = screen.getAllByRole('group', {name: /^Slide /});\n"
        "    const viewClasses = viewSlides.map(slide => slide.className);\n"
        "    expect(viewClasses[0]).toBe(viewClasses[1]);\n"
        "    rerender(\n"
        "      <Carousel itemWidth=\"content\" aria-label=\"Paged\">\n"
        "        <div>One</div>\n"
        "        <div>Two</div>\n"
        "      </Carousel>,\n"
        "    );\n"
        "    const contentSlides = screen.getAllByRole('group', {name: /^Slide /});\n"
        "    expect(contentSlides[0]?.className).not.toBe(viewClasses[0]);\n"
        "  });\n\n"
        "  it('exposes each slide as a group with aria-roledescription=\"slide\" and a positional name', () => {",
    )

    replace_once(
        carousel_test,
        "  it('exposes each slide as a group with aria-roledescription=\"slide\" and a positional name', () => {",
        "  it('keeps imperative reposition available while user scrolling is suspended', () => {\n"
        "    const handle = createRef<CarouselHandle>();\n"
        "    render(\n"
        "      <Carousel scrollingBehavior=\"suspended\" handleRef={handle} aria-label=\"Locked\">\n"
        "        <div>One</div>\n"
        "        <div>Two</div>\n"
        "      </Carousel>,\n"
        "    );\n"
        "    const scroller = screen.getByRole('group', {name: 'Locked'});\n"
        "    const scrollBy = vi.fn();\n"
        "    scroller.scrollBy = scrollBy;\n"
        "    act(() => handle.current?.scrollTo(1, {animated: false}));\n"
        "    expect(scrollBy).toHaveBeenCalled();\n"
        "    expect(scroller.tabIndex).toBe(-1);\n"
        "  });\n\n"
        "  it('exposes each slide as a group with aria-roledescription=\"slide\" and a positional name', () => {",
    )

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
        "      row.scrollTo = ((optionsOrX?: ScrollToOptions | number) => {\n"
        "        const left =\n"
        "          typeof optionsOrX === 'number' ? optionsOrX : optionsOrX?.left;\n"
        "        if (typeof left === 'number') row.scrollLeft = left;\n"
        "      }) as HTMLElement['scrollTo'];\n\n"
        "      act(() => handle.current?.scrollTo(1, {animated: false}));\n"
        "      expect(settles).toEqual([[1, 0]]);\n"
        "    });\n\n"
        "    it('moves the row through the paging for a scroll to an item', () => {",
    )

    carousel_doc = root / "packages/core/src/Carousel/Carousel.doc.mjs"
    replace_once(
        carousel_doc,
        "    {name: 'children', type: 'ReactNode', description: 'Carousel items rendered in a horizontal scroll container.', required: true},",
        "    {name: 'children', type: 'ReactNode', description: 'Carousel items rendered in a horizontal scroll container.', required: true},\n"
        "    {name: 'itemWidth', type: \"'content' | 'view'\", description: \"Width owned by each Carousel slide wrapper. 'view' makes every slide exactly one Carousel scroll viewport wide.\", default: \"'content'\"},\n"
        "    {name: 'scrollingBehavior', type: \"'enabled' | 'suspended'\", description: \"User-originated horizontal scrolling and paging. 'suspended' cancels/suspends Carousel-owned horizontal input while programmatic handle movement remains available.\", default: \"'enabled'\"},",
    )
    replace_once(
        carousel_doc,
        "    children: '在水平滚动容器中渲染的轮播项目。',",
        "    children: '在水平滚动容器中渲染的轮播项目。',\n"
        "    itemWidth: \"每个轮播项目包装器的宽度。'view' 使每个项目恰好占满一个轮播视口。\",\n"
        "    scrollingBehavior: \"用户发起的水平滚动和分页；'suspended' 会暂停 Carousel 输入，同时命令式句柄仍可移动。\",",
    )
    replace_once(
        carousel_doc,
        "    children: 'carousel items in horizontal scroll',",
        "    children: 'carousel items in horizontal scroll',\n"
        "    itemWidth: \"slide wrapper width; 'view' = one Carousel viewport\",\n"
        "    scrollingBehavior: \"user horizontal scroll/paging behavior; 'suspended' keeps imperative movement available\",",
    )

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


    spec = root / "docs/specs/components/Carousel/Carousel.spec.md"
    replace_once(
        spec,
        "The edge scroll buttons hide and hand off focus at an edge (FR1–FR4).",
        "Controlled paging additionally exposes final-rest notification, immediate contained repositioning, one-view slide sizing and suspendable user scrolling (FR10). The edge scroll buttons hide and hand off focus at an edge (FR1–FR4).",
    )
    replace_once(
        spec,
        "Implementation gap: shipped Carousel still uses native `disabled` on edge buttons.",
        "The FR10 additions are additive and preserve released defaults. Implementation gap: shipped Carousel still uses native `disabled` on edge buttons.",
    )
    replace_once(
        spec,
        "focus left on a hidden edge button.",
        "a Carousel with `scrollingBehavior='suspended'` that still moves from user input or loses imperative movement; focus left on a hidden edge button.",
    )
    replace_once(
        spec,
        "- Controlled/uncontrolled behavior: unchanged.",
        "- Controlled paging additions are additive: `SnapPagingOptions.onSettle`, `CarouselHandle.scrollTo(index, {animated})`, `itemWidth` and `scrollingBehavior`. Omitted values preserve released behavior; `scrollingBehavior` defaults to `'enabled'` and `itemWidth` to `'content'`.\n- Controlled/uncontrolled behavior: unchanged.",
    )
    replace_once(
        spec,
        "- Edge scroll button visibility, tab order, and the focus destination when one\n  runs out.",
        "- Bounded controlled-paging seams: final-rest notification, immediate contained repositioning, slide-wrapper view sizing, and suspension of user-originated Carousel scrolling while imperative movement remains available (FR10).\n- Edge scroll button visibility, tab order, and the focus destination when one\n  runs out.",
    )
    replace_once(
        spec,
        "| `SnapPagingOptions`       | `{pages?: 'view' \\| 'item'}`          | Options for the hook. `pages` sets what one flick moves (FR7). A field is added only by a current record                          | —                                         | `{pages: 'view'}` | `component:Carousel` | stable    | TypeScript rejects unknown fields and values |",
        "| `SnapPagingOptions`       | `{pages?: 'view' \\| 'item'; onSettle?: (index: number, previous: number) => void}` | Options for the hook. `pages` sets what one flick moves (FR7); `onSettle` reports the final rested page after a gesture or Carousel programmatic paging move (FR10). | — | `{pages: 'view'}` | `component:Carousel` | stable | TypeScript rejects unknown fields and values |\n| `itemWidth`               | `'content' \\| 'view'`                 | Width owned by each Carousel slide wrapper; `'view'` makes every slide exactly one Carousel scroll viewport wide (FR10). | Every Carousel | `'content'` | `component:Carousel` | proposed | TypeScript rejects other values |\n| `scrollingBehavior`       | `'enabled' \\| 'suspended'`            | User-originated horizontal Carousel scrolling/paging. `'suspended'` cancels/detaches active paging and prevents user travel while imperative handle movement remains available (FR10). | Every Carousel | `'enabled'` | `component:Carousel` | proposed | TypeScript rejects other values |\n| `CarouselHandle.scrollTo` | `(index: number, options?: {animated?: boolean}) => void` | Moves to a slide; `animated: false` forces immediate contained repositioning (FR10). | `handleRef` callers | animated | `component:Carousel` | proposed | Index remains clamped |",
    )
    replace_once(
        spec,
        "\n### Representative states",
        "\n| FR10 | A bounded controlled-paging consumer may opt into four independent caller-owned seams. `itemWidth='view'` makes every public slide wrapper exactly one Carousel scroll viewport wide. `SnapPagingOptions.onSettle(index, previous)` reports after paging fully rests on a page selected by a gesture or Carousel programmatic move. `CarouselHandle.scrollTo(index, {animated: false})` repositions immediately without scrolling an ancestor. `scrollingBehavior='suspended'` cancels/detaches active snap paging, prevents user-originated horizontal touch/pen/trackpad/wheel travel, removes the scroll area from the tab order and makes built-in edge navigation unavailable while leaving imperative handle movement available; `'enabled'` restores the same paging value. Carousel cannot derive an external gesture owner's lock, a consumer's bounded-window canonical commit or its recenter point, so these are caller-owned inputs. | `architecture:public-component-api` INV2–INV4; `spec:AST-094` FR24 | proposed; owner review required |\n\n### Representative states",
    )
    replace_once(
        spec,
        "\n## Accessibility contract",
        "\n| User scrolling suspended              | No user-originated horizontal Carousel travel; any active snap paging is cancelled; imperative `scrollTo(..., {animated: false})` still repositions | Child controls remain independently interactive |\n\n## Accessibility contract",
    )
    replace_once(
        spec,
        "| FR8      | Bundle test over Core's source",
        "| FR10     | `Carousel.test.tsx` and `SnapPaging.test.tsx` plus real-browser consumer acceptance before merge | one-view slide wrappers; final-rest callback; immediate recenter; enabled→suspended→enabled lifecycle; suspension during an active external drag | A wrong wrapper width, missing/duplicate final-rest report, animated immediate recenter, any user-originated horizontal Carousel travel while suspended, a surviving paging gesture after suspension, or loss of imperative reposition fails | — |\n| FR8      | Bundle test over Core's source",
    )
    replace_once(
        spec,
        "## Open questions\n\nNone.",
        "## Open questions\n\n- Owner review is required before merge for the FR10 public delta and exact public names. The candidate names are `itemWidth`, `scrollingBehavior`, `SnapPagingOptions.onSettle` and `CarouselHandle.scrollTo(index, {animated})`; equivalent owner-approved names are acceptable only if they preserve the same ownership and defaults.",
    )

    changeset = root / ".changeset/carousel-settled-reposition.md"
    changeset.write_text(
        "---\n"
        "'@astryxdesign/core': patch\n"
        "---\n\n"
        "[feature] Carousel snap paging can report its final settled page, "
        "CarouselHandle.scrollTo can reposition without animation, and "
        "itemWidth='view' can make each public slide exactly one Carousel viewport wide, and "
        "scrollingBehavior can suspend user-originated Carousel travel without blocking imperative repositioning.\n\n"
        "@rpstreef\n"
    )

    print(f"Applied Astryx Carousel lifecycle seam to {root}")
    print(f"Expected base: {BASE_SHA}")

if __name__ == "__main__":
    main()
