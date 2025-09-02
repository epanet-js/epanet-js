import { momentLogAtom } from "src/state/jotai";
import { useAtomValue } from "jotai";
import * as DD from "@radix-ui/react-dropdown-menu";
import {
  CaretRightIcon,
  ArrowRightIcon as DeprecatedArrowRightIcon,
} from "@radix-ui/react-icons";
import {
  styledButton,
  DDContent,
  DDLabel,
  DDSubContent,
  StyledItem,
  DDSubTriggerItem,
} from "src/components/elements";
import React, { useMemo } from "react";
import { usePersistence } from "src/lib/persistence/context";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { ArrowRightIcon, ChevronRightIcon } from "src/icons";

function UndoList() {
  const rep = usePersistence();
  const historyControl = rep.useHistoryControl();
  const momentLog = useAtomValue(momentLogAtom);
  const isLucideIconsOn = useFeatureFlag("FLAG_LUCIDE_ICONS");

  const MomentsList = useMemo(() => {
    const List = [];
    for (const { moment, offset, position } of momentLog) {
      List.push(
        <StyledItem
          key={position}
          onSelect={(_e) => {
            for (let j = 0; j < Math.abs(offset); j++) {
              offset > 0 ? historyControl("undo") : historyControl("redo");
            }
          }}
        >
          {isLucideIconsOn ? (
            <ArrowRightIcon />
          ) : (
            <DeprecatedArrowRightIcon className="opacity-0" />
          )}
          {moment.note || ""}
        </StyledItem>,
      );
      if (offset === 0)
        List.push(
          <DDLabel key="current-state">
            <div className="flex items-center gap-x-2">
              {isLucideIconsOn ? (
                <ArrowRightIcon />
              ) : (
                <DeprecatedArrowRightIcon />
              )}
              Current state
            </div>
          </DDLabel>,
        );
    }
    return List;
  }, [momentLog, historyControl, isLucideIconsOn]);

  return <DDSubContent>{MomentsList}</DDSubContent>;
}

export function DebugDropdown() {
  const isLucideIconsOn = useFeatureFlag("FLAG_LUCIDE_ICONS");
  return (
    <div className="flex items-center">
      <DD.Root>
        <DD.Trigger className={styledButton({ size: "sm", variant: "quiet" })}>
          <span>Debug</span>
        </DD.Trigger>
        <DD.Portal>
          <DDContent align="end">
            <DD.Sub>
              <DDSubTriggerItem>
                Undo history
                <div className="flex-auto" />
                {isLucideIconsOn ? <ChevronRightIcon /> : <CaretRightIcon />}
              </DDSubTriggerItem>
              <UndoList />
            </DD.Sub>
          </DDContent>
        </DD.Portal>
      </DD.Root>
    </div>
  );
}
