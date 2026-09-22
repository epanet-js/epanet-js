import * as DD from "@radix-ui/react-dropdown-menu";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { MoreActionsIcon } from "src/icons";
import { localizeKeybinding } from "src/infra/i18n";
import { Action, ActionButton } from "./action-button";
import { Button, DDContent, Keycap, StyledItem } from "./elements";

export function ActionsBar({
  actions,
  className,
}: {
  actions: Action[];
  className?: string;
}) {
  const translate = useTranslate();
  const moreActionsLabel = translate("moreActions");
  const applicable = actions.filter((action) => action.applicable);
  const { containerRef, visibleCount } = useActionsThatFit(
    applicable,
    moreActionsLabel,
  );
  const overflowing = applicable.slice(visibleCount);

  return (
    <div
      ref={containerRef}
      className={clsx("flex gap-1 shrink-0 justify-end", className)}
    >
      {applicable.slice(0, visibleCount).map((action) => (
        <ActionButton key={action.label} action={action} />
      ))}
      {overflowing.length > 0 && (
        <MoreActions actions={overflowing} label={moreActionsLabel} />
      )}
    </div>
  );
}

export const actionsThatFit = (
  widths: number[],
  moreWidth: number,
  gap: number,
  available: number,
): number => {
  const whole =
    widths.reduce((total, width) => total + width, 0) +
    gap * (widths.length - 1);
  if (whole <= available + WIDTH_TOLERANCE) return widths.length;

  let used = moreWidth;
  let fitting = 0;
  for (const width of widths) {
    const grown = used + gap + width;
    if (grown > available + WIDTH_TOLERANCE) break;
    used = grown;
    fitting++;
  }
  return fitting;
};

function MoreActions({ actions, label }: { actions: Action[]; label: string }) {
  return (
    <DD.Root modal={false}>
      <DD.Trigger asChild>
        <Button variant="quiet" aria-label={label} className="h-8">
          <MoreActionsIcon />
        </Button>
      </DD.Trigger>
      <DD.Portal>
        <DDContent align="end" side="bottom" className="z-50 min-w-40">
          {actions.map((action) => (
            <StyledItem
              key={action.label}
              variant={action.variant ?? "quiet"}
              disabled={action.disabled}
              data-state={action.selected ? "checked" : undefined}
              className="data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed"
              onSelect={(event: Event) => {
                void action.onSelect(event);
              }}
            >
              {action.icon}
              <span className="grow whitespace-nowrap">{action.label}</span>
              {action.shortcut ? (
                <Keycap size="xs">{localizeKeybinding(action.shortcut)}</Keycap>
              ) : null}
            </StyledItem>
          ))}
        </DDContent>
      </DD.Portal>
    </DD.Root>
  );
}

const WIDTH_TOLERANCE = 1;

const useActionsThatFit = (actions: Action[], moreActionsLabel: string) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const measuredWidths = useRef(new Map<string, number>());
  const [visibleCount, setVisibleCount] = useState(actions.length);
  const labels = useRef<string[]>([]);
  labels.current = actions.map((action) => action.label);
  const whichActions = labels.current.join("|");

  useEffect(
    function collapseWhatDoesNotFit() {
      const container = containerRef.current;
      const row = container?.parentElement;
      if (!container || !row) return;

      const siblings = Array.from(row.children).filter(
        (child) => child !== container,
      ) as HTMLElement[];
      const keepTheirWidth = siblings.filter(cannotShrink);
      const reserved = siblings.reduce(
        (total, sibling) =>
          total + (cannotShrink(sibling) ? 0 : floorOf(sibling)),
        gapOf(row) * siblings.length,
      );
      const gapBetweenActions = gapOf(container);

      const measure = () => {
        const rowWidth = row.clientWidth;
        if (rowWidth <= 0) return;

        const available = Math.max(
          0,
          rowWidth -
            keepTheirWidth.reduce(
              (total, sibling) => total + sibling.offsetWidth,
              reserved,
            ),
        );

        const widths = measuredWidths.current;
        recordWidths(container, widths);
        const widthOf = (label: string) =>
          widths.get(label) ?? widestOf(widths);

        setVisibleCount(
          actionsThatFit(
            labels.current.map(widthOf),
            widthOf(moreActionsLabel),
            gapBetweenActions,
            available,
          ),
        );
      };

      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(row);
      for (const sibling of keepTheirWidth) observer.observe(sibling);
      return () => observer.disconnect();
    },
    [whichActions, moreActionsLabel],
  );

  return { containerRef, visibleCount };
};

const cannotShrink = (element: HTMLElement): boolean =>
  parseFloat(getComputedStyle(element).flexShrink) === 0;

const floorOf = (element: HTMLElement): number => {
  const floor = parseFloat(getComputedStyle(element).minWidth);
  return Number.isNaN(floor) ? 0 : floor;
};

const recordWidths = (
  container: HTMLElement,
  widths: Map<string, number>,
): void => {
  for (const child of Array.from(container.children)) {
    const label = child.getAttribute("aria-label");
    if (label && !widths.has(label)) {
      widths.set(label, (child as HTMLElement).offsetWidth);
    }
  }
};

const widestOf = (widths: Map<string, number>): number =>
  widths.size === 0 ? 0 : Math.max(...widths.values());

const gapOf = (container: HTMLElement): number =>
  parseFloat(getComputedStyle(container).columnGap) || 0;
