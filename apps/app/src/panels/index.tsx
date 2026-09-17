import { memo } from "react";
import { dialogAtom } from "src/state/dialog";
import { splitsAtom } from "src/state/layout";
import { useAtomValue } from "jotai";

import { BottomResizer } from "src/components/resizer";
import { BottomDock } from "./bottom-dock/bottom-dock";
import { LeftDock } from "./left-dock/left-dock";
import { RightDock } from "./right-dock/right-dock";

export { ActivityBar } from "./activity-bar/activity-bar";

export const SidePanel = memo(function SidePanelInner() {
  const splits = useAtomValue(splitsAtom);
  if (!splits.rightOpen) return null;
  return (
    <div
      style={{
        width: splits.right,
      }}
      className="bg-popover border-l relative"
    >
      <RightSide />
    </div>
  );
});

const RightSide = memo(function RightSideInner() {
  const dialog = useAtomValue(dialogAtom);

  if (dialog && dialog.type === "welcome") return null;
  return <RightDock />;
});

export const RelocatedSidePanel = memo(function RelocatedSidePanelInner() {
  return (
    <div className="bg-popover border-t relative flex-auto min-h-0">
      <RightSide />
    </div>
  );
});

export const BottomPanel = memo(function BottomPanelInner() {
  const splits = useAtomValue(splitsAtom);

  if (!splits.bottomOpen) return null;

  return (
    <div
      style={{ height: splits.bottom }}
      className="relative shrink-0 bg-popover border-t flex flex-col"
    >
      <BottomResizer />
      <div className="flex-1 min-h-0 relative">
        <BottomDock />
      </div>
    </div>
  );
});

export const LeftSidePanel = memo(function LeftSidePanelInner() {
  const splits = useAtomValue(splitsAtom);
  if (!splits.leftOpen) return null;
  return (
    <div
      style={{
        width: splits.left,
      }}
      className="bg-popover border-r relative"
    >
      <LeftDock />
    </div>
  );
});
