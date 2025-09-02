import React, { useState, KeyboardEventHandler } from "react";
import * as P from "@radix-ui/react-popover";
import { CardStackIcon } from "@radix-ui/react-icons";
import { useSetAtom } from "jotai";
import { StyledPopoverArrow, StyledPopoverContent } from "../../elements";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { useTranslate } from "src/hooks/use-translate";
import { Unit } from "src/quantity";
import { ephemeralStateAtom } from "src/state/jotai";
import { CustomerPointsPopover } from "./customer-points-popover";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { MultipleAssetsIcon } from "src/icons";

interface CustomerDemandFieldProps {
  totalDemand: number;
  customerCount: number;
  customerPoints: CustomerPoint[];
  aggregateUnit: Unit;
  customerUnit: Unit;
}

export const CustomerDemandField = ({
  totalDemand,
  customerCount,
  customerPoints,
  aggregateUnit,
  customerUnit,
}: CustomerDemandFieldProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const translate = useTranslate();
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const isLucideIconsOn = useFeatureFlag("FLAG_LUCIDE_ICONS");

  const handleClose = () => {
    setEphemeralState({ type: "none" });
    setIsOpen(false);
  };

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
      <P.Root
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleClose();
          } else {
            setIsOpen(true);
            setEphemeralState({
              type: "customerPointsHighlight",
              customerPoints: customerPoints,
            });
          }
        }}
      >
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
          {isLucideIconsOn ? (
            <MultipleAssetsIcon className="flex-shrink-0" />
          ) : (
            <CardStackIcon className="flex-shrink-0" />
          )}
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
              aggregateUnit={aggregateUnit}
              customerUnit={customerUnit}
              onClose={handleClose}
            />
          </StyledPopoverContent>
        </P.Portal>
      </P.Root>
    </div>
  );
};
