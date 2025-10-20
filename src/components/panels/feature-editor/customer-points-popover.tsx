import React, { KeyboardEventHandler, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useSetAtom } from "jotai";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { Unit, convertTo } from "src/quantity";
import { ephemeralStateAtom } from "src/state/jotai";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

interface CustomerPointsPopoverProps {
  customerPoints: CustomerPoint[];
  aggregateUnit: Unit;
  customerUnit: Unit;
  onClose: () => void;
}

const itemSize = 32;

export const CustomerPointsPopover = ({
  customerPoints,
  aggregateUnit,
  customerUnit,
  onClose,
}: CustomerPointsPopoverProps) => {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const useLabelFlag = useFeatureFlag("FLAG_CUSTOMER_LABEL");

  const handleCustomerPointHover = (customerPoint: CustomerPoint) => {
    setEphemeralState({
      type: "customerPointsHighlight",
      customerPoints: [customerPoint],
    });
  };

  const handleCustomerPointLeave = () => {
    setEphemeralState({
      type: "customerPointsHighlight",
      customerPoints: customerPoints,
    });
  };

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
      setEphemeralState({ type: "none" });
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
          {translate("demand")} ({translateUnit(customerUnit)})
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
            const demandValue = localizeDecimal(
              convertTo(
                { value: customerPoint.baseDemand, unit: aggregateUnit },
                customerUnit,
              ),
            );
            const displayValue = useLabelFlag
              ? customerPoint.label
              : customerPoint.id;

            return (
              <div
                key={virtualRow.index}
                role="listitem"
                aria-label={`Customer point ${displayValue}: ${demandValue}`}
                className="top-0 left-0 block w-full absolute py-2 px-2 flex items-center
                hover:bg-gray-200 dark:hover:bg-gray-700
                gap-x-2 even:bg-gray-100 dark:even:bg-gray-800"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onMouseEnter={() => handleCustomerPointHover(customerPoint)}
                onMouseLeave={handleCustomerPointLeave}
              >
                <div
                  title={displayValue}
                  className="flex-auto font-mono text-xs truncate"
                >
                  {displayValue}
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
