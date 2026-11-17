import { memo } from "react";
import { useAtomValue } from "jotai";
import { TabRoot } from "src/components/tab";
import { DefaultErrorBoundary } from "src/components/elements";
import { activePanelIn, panelsIn } from "src/state/panels";
import { PanelContent } from "../panel-template";
import { DockEmptyState } from "../dock-empty-state";
import { DockTabStrip, useDockTabChange } from "../dock-tabs/dock-tabs";

const bottomPanelsAtom = panelsIn("bottom");
const activeBottomPanelAtom = activePanelIn("bottom");

export const BottomDock = memo(function BottomDockInner() {
  const panels = useAtomValue(bottomPanelsAtom);
  const activePanel = useAtomValue(activeBottomPanelAtom);
  const handleTabChange = useDockTabChange(
    panels,
    activePanel,
    "bottomPanel.tabSwitched",
  );

  if (panels.length === 0) return <DockEmptyState />;

  return (
    <TabRoot
      value={activePanel?.id ?? undefined}
      onValueChange={handleTabChange}
      className="absolute inset-0 flex flex-col"
    >
      <DockTabStrip panels={panels} />
      <div className="flex-1 min-h-0 min-w-0 flex flex-col relative">
        <DefaultErrorBoundary>
          {activePanel && (
            <PanelContent key={activePanel.id} panel={activePanel.panel} />
          )}
        </DefaultErrorBoundary>
      </div>
    </TabRoot>
  );
});
