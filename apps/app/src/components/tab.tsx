import * as Tabs from "@radix-ui/react-tabs";
import clsx from "clsx";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { ChevronLeftIcon, ChevronRightIcon } from "src/icons";

export const TabRoot = Tabs.Root;

const EDGE_TOLERANCE = 1;

type TabBox = { start: number; end: number };

export const scrollTargetFor = (
  tabs: readonly TabBox[],
  scrollLeft: number,
  viewport: number,
  direction: -1 | 1,
): number => {
  if (direction === 1) {
    const cutOff = tabs.find(
      (tab) => tab.end > scrollLeft + viewport + EDGE_TOLERANCE,
    );
    return cutOff ? cutOff.end - viewport : scrollLeft;
  }

  for (let i = tabs.length - 1; i >= 0; i--) {
    if (tabs[i].start < scrollLeft - EDGE_TOLERANCE) return tabs[i].start;
  }
  return scrollLeft;
};

const measureTabs = (list: HTMLElement): TabBox[] => {
  const listLeft = list.getBoundingClientRect().left;
  return Array.from(list.children).map((tab) => {
    const rect = tab.getBoundingClientRect();
    const start = rect.left - listLeft + list.scrollLeft;
    return { start, end: start + rect.width };
  });
};

type Overflow = { scrollable: boolean; start: boolean; end: boolean };

const NO_OVERFLOW: Overflow = { scrollable: false, start: false, end: false };

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

  const scrollByStep = useCallback((direction: -1 | 1) => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({
      left: scrollTargetFor(
        measureTabs(list),
        list.scrollLeft,
        list.clientWidth,
        direction,
      ),
    });
  }, []);

  return (
    <div className="flex-none flex items-stretch border-b bg-popover border">
      {overflow.scrollable && (
        <ScrollControl
          label={translate("tabs.scrollLeft")}
          disabled={!overflow.start}
          onClick={() => scrollByStep(-1)}
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
          onClick={() => scrollByStep(1)}
        >
          <ChevronRightIcon />
        </ScrollControl>
      )}
    </div>
  );
}

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
        `text-size-base text-subtle
           hover:text-default
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
