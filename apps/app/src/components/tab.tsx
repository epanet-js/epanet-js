import * as Tabs from "@radix-ui/react-tabs";
import clsx from "clsx";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { ChevronLeftIcon, ChevronRightIcon } from "src/icons";

export const TabRoot = Tabs.Root;

export function TabList({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof Tabs.List>) {
  const listRef = useRef<HTMLDivElement>(null);
  const translate = useTranslate();
  const [overflow, setOverflow] = useState<Overflow>(NO_OVERFLOW);

  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const maxScroll = list.scrollWidth - list.clientWidth;
    const scrollable = maxScroll > 1;
    const start = list.scrollLeft > 1;
    const end = list.scrollLeft < maxScroll - 1;
    setOverflow((previous) =>
      previous.scrollable === scrollable &&
      previous.start === start &&
      previous.end === end
        ? previous
        : { scrollable, start, end },
    );
  }, []);

  useEffect(
    function trackOverflow() {
      const list = listRef.current;
      if (!list) return;

      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(list);
      for (const tab of Array.from(list.children)) observer.observe(tab);
      return () => observer.disconnect();
    },
    [measure, children],
  );

  useEffect(function scrollWithTheWheel() {
    const list = listRef.current;
    if (!list) return;

    // Registered natively rather than via onWheel so it can preventDefault:
    // React's wheel listener is passive, which makes the page scroll instead.
    const scrollSideways = (event: WheelEvent) => {
      if (event.deltaY === 0) return;
      if (list.scrollWidth <= list.clientWidth) return;
      event.preventDefault();
      list.scrollLeft += event.deltaY;
    };

    list.addEventListener("wheel", scrollSideways, { passive: false });
    return () => list.removeEventListener("wheel", scrollSideways);
  }, []);

  useEffect(function keepTheActiveTabVisible() {
    const list = listRef.current;
    if (!list) return;

    let lastTabShown: Element | null = null;

    // Only a change of tab pulls the strip: showing the same one again would
    // undo the scrolling the reader has done since.
    const ensureActiveTabIsVisible = () => {
      const active = activeTabIn(list);
      if (!active || active.element === lastTabShown) return;
      lastTabShown = active.element;
      scrollListTo(
        list,
        pageShowing(active.box, list.scrollLeft, list.clientWidth),
      );
    };

    ensureActiveTabIsVisible();
    const observer = watchTheTabs(list, ensureActiveTabIsVisible);
    return () => observer.disconnect();
  }, []);

  const scrollByPage = useCallback((direction: -1 | 1) => {
    const list = listRef.current;
    if (!list) return;
    scrollListTo(
      list,
      pageToward(
        measureTabs(list),
        list.scrollLeft,
        list.clientWidth,
        direction,
      ),
    );
  }, []);

  return (
    <div className="flex-none flex items-stretch border-b bg-popover border">
      {overflow.scrollable && (
        <ScrollControl
          label={translate("tabs.scrollLeft")}
          disabled={!overflow.start}
          onClick={() => scrollByPage(-1)}
        >
          <ChevronLeftIcon />
        </ScrollControl>
      )}
      <div className="scroll-shadows-x flex-1 min-w-0 flex">
        <Tabs.List
          ref={listRef}
          onScroll={measure}
          className={clsx(
            "scroll-shadows-x-inner flex-1 flex overflow-x-auto overscroll-x-none scrollbar-hidden",
            className,
          )}
          {...props}
        >
          {children}
        </Tabs.List>
      </div>
      {overflow.scrollable && (
        <ScrollControl
          label={translate("tabs.scrollRight")}
          disabled={!overflow.end}
          onClick={() => scrollByPage(1)}
        >
          <ChevronRightIcon />
        </ScrollControl>
      )}
    </div>
  );
}

export const Tab = forwardRef<
  React.ElementRef<typeof Tabs.Trigger>,
  React.ComponentPropsWithoutRef<typeof Tabs.Trigger>
>(function Tab({ className, ...props }, ref) {
  return (
    <Tabs.Trigger
      ref={ref}
      className={clsx(
        `px-4 h-8 shrink-0 whitespace-nowrap
        border-b-2 border-transparent
        focus:outline-hidden focus-visible:ring-1 focus-visible:ring-inset
        transition-colors`,
        `text-size-base text-default
           hover:bg-base-hover
           data-[state=active]:text-accent
           data-[state=active]:border-accent
           focus-visible:ring-accent`,
        className,
      )}
      {...props}
    />
  );
});

function ScrollControl({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex-none w-8 inline-flex items-center justify-center
        text-subtle transition-colors
        enabled:hover:text-default enabled:hover:bg-base-hover
        disabled:opacity-30"
    >
      {children}
    </button>
  );
}

const EDGE_TOLERANCE = 1;

type TabBox = { start: number; end: number };

// The stretch of the strip on show, in the strip's own coordinates.
type Page = { from: number; to: number };

type Overflow = { scrollable: boolean; start: boolean; end: boolean };

const NO_OVERFLOW: Overflow = { scrollable: false, start: false, end: false };

const pageAt = (scrollLeft: number, viewport: number): Page => ({
  from: scrollLeft,
  to: scrollLeft + viewport,
});

const widthOf = (page: Page) => page.to - page.from;

const startsBeforePage = (tab: TabBox, page: Page) =>
  tab.start < page.from - EDGE_TOLERANCE;

const endsAfterPage = (tab: TabBox, page: Page) =>
  tab.end > page.to + EDGE_TOLERANCE;

const showsWhole = (tab: TabBox, page: Page) =>
  !startsBeforePage(tab, page) && !endsAfterPage(tab, page);

const asFirstOfPage = (tab: TabBox) => tab.start;

const asLastOfPage = (tab: TabBox, page: Page) => tab.end - widthOf(page);

const firstTab = (
  tabs: readonly TabBox[],
  match: (tab: TabBox) => boolean,
): TabBox | undefined => tabs.find(match);

const lastTab = (
  tabs: readonly TabBox[],
  match: (tab: TabBox) => boolean,
): TabBox | undefined => {
  for (let i = tabs.length - 1; i >= 0; i--) {
    if (match(tabs[i])) return tabs[i];
  }
  return undefined;
};

const withinStrip = (
  target: number,
  tabs: readonly TabBox[],
  page: Page,
): number => {
  const stripEnd = tabs[tabs.length - 1]?.end ?? 0;
  return Math.min(Math.max(target, 0), Math.max(0, stripEnd - widthOf(page)));
};

const pageAfter = (tabs: readonly TabBox[], page: Page): number => {
  const hinge = lastTab(tabs, (tab) => showsWhole(tab, page));
  if (hinge && asFirstOfPage(hinge) > page.from + EDGE_TOLERANCE) {
    return asFirstOfPage(hinge);
  }
  const next = firstTab(tabs, (tab) => tab.start > page.from + EDGE_TOLERANCE);
  return next ? asFirstOfPage(next) : page.to;
};

const pageBefore = (tabs: readonly TabBox[], page: Page): number => {
  const hinge = firstTab(tabs, (tab) => showsWhole(tab, page));
  if (hinge && asLastOfPage(hinge, page) < page.from - EDGE_TOLERANCE) {
    return asLastOfPage(hinge, page);
  }
  const previous = lastTab(tabs, (tab) => tab.end < page.to - EDGE_TOLERANCE);
  return previous ? asLastOfPage(previous, page) : page.from - widthOf(page);
};

const pageToward = (
  tabs: readonly TabBox[],
  scrollLeft: number,
  viewport: number,
  direction: -1 | 1,
): number => {
  const page = pageAt(scrollLeft, viewport);
  const target =
    direction === 1 ? pageAfter(tabs, page) : pageBefore(tabs, page);
  return withinStrip(target, tabs, page);
};

const pageShowing = (
  tab: TabBox,
  scrollLeft: number,
  viewport: number,
): number => {
  const page = pageAt(scrollLeft, viewport);
  if (startsBeforePage(tab, page)) return asFirstOfPage(tab);
  if (endsAfterPage(tab, page)) return asLastOfPage(tab, page);
  return page.from;
};

const measureTabs = (list: HTMLElement): TabBox[] => {
  const listLeft = list.getBoundingClientRect().left;
  return Array.from(list.children).map((tab) => {
    const rect = tab.getBoundingClientRect();
    const start = rect.left - listLeft + list.scrollLeft;
    return { start, end: start + rect.width };
  });
};

const activeTabIn = (
  list: HTMLElement,
): { element: Element; box: TabBox } | null => {
  const tabs = Array.from(list.children);
  const index = tabs.findIndex(
    (tab) => tab.getAttribute("data-state") === "active",
  );
  if (index === -1) return null;
  return { element: tabs[index], box: measureTabs(list)[index] };
};

const watchTheTabs = (list: HTMLElement, onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(list, {
    childList: true,
    subtree: true,
    attributeFilter: ["data-state"],
  });
  return observer;
};

const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

const scrollListTo = (list: HTMLElement, left: number) => {
  if (left === list.scrollLeft) return;
  list.scrollTo({
    left,
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
};
