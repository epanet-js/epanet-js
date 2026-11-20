import { useLayoutEffect, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import clsx from "clsx";
import { useSelectorPortalContainer } from "@epanet-js/ui-kit";
import * as E from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";

export type LegendItem = {
  label: string;
  color: string;
  mark: "line" | "points";
  hidden?: boolean;
};

const ITEM_GAP_PX = 12;

export const legendItemsThatFit = (
  itemWidths: readonly number[],
  available: number,
  triggerWidth: number,
  gap = ITEM_GAP_PX,
): number => {
  const total =
    itemWidths.reduce((sum, width) => sum + width, 0) +
    gap * Math.max(0, itemWidths.length - 1);
  if (total <= available) return itemWidths.length;

  let used = triggerWidth;
  let count = 0;
  for (const width of itemWidths) {
    if (used + gap + width > available) break;
    used += gap + width;
    count += 1;
  }
  return count;
};

export const QuickGraphLegend = ({
  items,
  onToggle,
}: {
  items: LegendItem[];
  onToggle: (label: string) => void;
}) => {
  const translate = useTranslate();
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(items.length);

  const moreLabel = (hidden: number) => translate("andXMore", String(hidden));
  const collapsedLabel = translate("legendCollapsed");

  useLayoutEffect(
    function fitToWidth() {
      const container = containerRef.current;
      const measure = measureRef.current;
      if (!container || !measure) return;

      const compute = () => {
        const widths = [
          ...measure.querySelectorAll<HTMLElement>("[data-legend-item]"),
        ].map((element) => element.offsetWidth);
        const trigger =
          measure.querySelector<HTMLElement>("[data-legend-trigger]")
            ?.offsetWidth ?? 0;
        setVisibleCount(
          legendItemsThatFit(widths, container.clientWidth, trigger),
        );
      };

      compute();
      const observer = new ResizeObserver(compute);
      observer.observe(container);
      return () => observer.disconnect();
    },
    [items],
  );

  const shown = items.slice(0, visibleCount);
  const hidden = items.slice(visibleCount);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 min-w-0 flex justify-end"
    >
      <div
        ref={measureRef}
        aria-hidden
        className="absolute w-max invisible pointer-events-none flex whitespace-nowrap text-size-small"
      >
        {items.map((item, index) => (
          <LegendEntry key={index} item={item} data-legend-item />
        ))}
        <span data-legend-trigger>{moreLabel(items.length)}</span>
      </div>
      <div className="flex items-center gap-3 whitespace-nowrap text-size-small text-subtle leading-5">
        {shown.map((item, index) => (
          <LegendToggle key={index} item={item} onToggle={onToggle} />
        ))}
        {hidden.length > 0 && (
          <HiddenEntries
            label={shown.length > 0 ? moreLabel(hidden.length) : collapsedLabel}
            items={hidden}
            onToggle={onToggle}
          />
        )}
      </div>
    </div>
  );
};

const HiddenEntries = ({
  label,
  items,
  onToggle,
}: {
  label: string;
  items: LegendItem[];
  onToggle: (label: string) => void;
}) => {
  const portalContainer = useSelectorPortalContainer();

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className="cursor-pointer hover:text-default">
          {label}
        </button>
      </Popover.Trigger>
      <Popover.Portal container={portalContainer}>
        <E.StyledPopoverContent
          size="auto"
          side="bottom"
          align="end"
          sideOffset={4}
        >
          <div className="flex flex-col items-start gap-1 text-size-small text-subtle">
            {items.map((item, index) => (
              <LegendToggle key={index} item={item} onToggle={onToggle} />
            ))}
          </div>
        </E.StyledPopoverContent>
      </Popover.Portal>
    </Popover.Root>
  );
};

const LegendToggle = ({
  item,
  onToggle,
}: {
  item: LegendItem;
  onToggle: (label: string) => void;
}) => (
  <button
    type="button"
    aria-pressed={!item.hidden}
    onClick={() => onToggle(item.label)}
    className={clsx(
      "cursor-pointer hover:text-default",
      item.hidden && "opacity-40",
    )}
  >
    <LegendEntry item={item} />
  </button>
);

const LegendEntry = ({
  item,
  ...rest
}: {
  item: LegendItem;
  "data-legend-item"?: boolean;
}) => (
  <span className="flex items-center gap-1.5 whitespace-nowrap" {...rest}>
    {item.mark === "line" ? (
      <span
        className="w-4 h-0.5 rounded-full shrink-0"
        style={{ backgroundColor: item.color }}
      />
    ) : (
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: item.color }}
      />
    )}
    {item.label}
  </span>
);
