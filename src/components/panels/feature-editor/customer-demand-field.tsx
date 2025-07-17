import React, { useState, KeyboardEventHandler, useRef } from "react";
import * as P from "@radix-ui/react-popover";
import { CardStackIcon } from "@radix-ui/react-icons";
import { useVirtualizer } from "@tanstack/react-virtual";
import { StyledPopoverArrow, StyledPopoverContent } from "../../elements";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { Unit } from "src/quantity";

interface CustomerDemandFieldProps {
  totalDemand: number;
  customerCount: number;
  customerPoints: CustomerPoint[];
  unit: Unit;
}

interface CustomerPointsPopoverProps {
  customerPoints: CustomerPoint[];
  unit: Unit;
  onClose: () => void;
}

const itemSize = 32;

const CustomerPointsPopover = ({
  customerPoints,
  unit,
  onClose,
}: CustomerPointsPopoverProps) => {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();

  const rowVirtualizer = useVirtualizer({
    count: customerPoints.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemSize,
    overscan: 5,
  });

  const handleContentKeyDown: KeyboardEventHandler<HTMLDivElement> = (
    event,
  ) => {
    if (event.code === "Escape" || event.code === "Enter") {
      event.stopPropagation();
      onClose();
    }
  };

  const handleListKeyDown: KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.code !== "ArrowDown" && event.code !== "ArrowUp") return;

    event.stopPropagation();
    rowVirtualizer.scrollBy(event.code === "ArrowDown" ? itemSize : -itemSize);
    parentRef.current && parentRef.current.focus();
  };

  return (
    <div onKeyDown={handleContentKeyDown}>
      <div className="font-sans text-gray-500 dark:text-gray-100 text-xs text-left py-2 flex font-bold border-b border-gray-200 dark:border-gray-700 rounded-t">
        <div className="flex-auto px-2">{translate("customer")}</div>
        <div className="px-2">
          {translate("demand")} ({translateUnit(unit)})
        </div>
      </div>
      <div
        ref={parentRef}
        onKeyDown={handleListKeyDown}
        className="max-h-32 overflow-y-auto"
        tabIndex={0}
      >
        <div
          className="w-full relative rounded"
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const customerPoint = customerPoints[virtualRow.index];
            const demandValue = localizeDecimal(customerPoint.baseDemand);

            return (
              <div
                key={virtualRow.index}
                role="listitem"
                aria-label={`Customer point ${customerPoint.id}: ${demandValue}`}
                className="top-0 left-0 block w-full absolute py-2 px-2 flex items-center
                hover:bg-gray-200 dark:hover:bg-gray-700
                gap-x-2 even:bg-gray-100 dark:even:bg-gray-800"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div
                  title={customerPoint.id}
                  className="flex-auto font-mono text-xs truncate"
                >
                  {customerPoint.id}
                </div>
                <div
                  className="text-xs font-mono text-gray-600 dark:text-gray-300"
                  title={`${translate("demand")}: ${demandValue}`}
                >
                  {demandValue}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const CustomerDemandField = ({
  totalDemand,
  customerCount,
  customerPoints,
  unit,
}: CustomerDemandFieldProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const translate = useTranslate();

  const handleTriggerKeyDown: KeyboardEventHandler<HTMLButtonElement> = (
    event,
  ) => {
    if (event.code === "Enter" && !isOpen) {
      setIsOpen(true);
      event.stopPropagation();
    }
  };

  const displayValue = `${localizeDecimal(totalDemand)} (${customerCount} ${translate("customers")})`;

  return (
    <div>
      <P.Root open={isOpen} onOpenChange={setIsOpen}>
        <P.Trigger
          aria-label={`Customer demand values: ${displayValue}`}
          onKeyDown={handleTriggerKeyDown}
          className="group
          text-left font-mono
          text-xs px-1.5 py-2
          text-gray-700

          focus-visible:ring-inset
          focus-visible:ring-1
          focus-visible:ring-purple-500
          aria-expanded:ring-1
          aria-expanded:ring-purple-500

          gap-x-1 block w-full
          dark:text-white bg-transparent
          flex overflow-hidden items-center"
        >
          <CardStackIcon className="flex-shrink-0" />
          <span className="flex-auto truncate">
            {localizeDecimal(totalDemand)} ({customerCount}{" "}
            {translate("customers")})
          </span>
        </P.Trigger>
        <P.Portal>
          <StyledPopoverContent>
            <StyledPopoverArrow />
            <CustomerPointsPopover
              customerPoints={customerPoints}
              unit={unit}
              onClose={() => setIsOpen(false)}
            />
          </StyledPopoverContent>
        </P.Portal>
      </P.Root>
    </div>
  );
};
