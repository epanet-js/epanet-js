import { momentLogAtom } from "src/state/jotai";
import { useAtomValue } from "jotai";
import * as DD from "@radix-ui/react-dropdown-menu";
import { CaretRightIcon, ArrowRightIcon } from "@radix-ui/react-icons";
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

function UndoList() {
  const rep = usePersistence();
  const historyControl = rep.useHistoryControl();
  const momentLog = useAtomValue(momentLogAtom);

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
          <ArrowRightIcon className="opacity-0" />
          {moment.note || ""}
        </StyledItem>,
      );
      if (offset === 0)
        List.push(
          <DDLabel key="current-state">
            <div className="flex items-center gap-x-2">
              <ArrowRightIcon />
              Current state
            </div>
          </DDLabel>,
        );
    }
    return List;
  }, [momentLog, historyControl]);

  return <DDSubContent>{MomentsList}</DDSubContent>;
}

export function DebugDropdown() {
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
                <CaretRightIcon />
              </DDSubTriggerItem>
              <UndoList />
            </DD.Sub>
          </DDContent>
        </DD.Portal>
      </DD.Root>
    </div>
  );
}
