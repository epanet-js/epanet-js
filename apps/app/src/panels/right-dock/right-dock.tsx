import { memo } from "react";
import { useAtomValue } from "jotai";
import { TabRoot } from "src/components/tab";
import { DefaultErrorBoundary } from "src/components/elements";
import { activePanelIn, panelsIn } from "src/state/panels";
import { PanelContent } from "../panel-template";
import { DockTabStrip, useDockTabChange } from "../dock-tabs/dock-tabs";

const rightPanelsAtom = panelsIn("right");
const activeRightPanelAtom = activePanelIn("right");

export const RightDock = memo(function RightDockInner() {
  const panels = useAtomValue(rightPanelsAtom);
  const activePanel = useAtomValue(activeRightPanelAtom);
  const handleTabChange = useDockTabChange(
    panels,
    activePanel,
    "rightPanel.tabSwitched",
  );

  if (panels.length === 0) return null;

  return (
    <TabRoot
      value={activePanel?.id ?? undefined}
      onValueChange={handleTabChange}
      className="absolute inset-0 flex flex-col"
    >
      {panels.length > 1 && <DockTabStrip panels={panels} />}
      <div className="flex-1 min-h-0 min-w-0 flex flex-col relative">
        <DefaultErrorBoundary>
          {activePanel && (
            <PanelContent
              key={activePanel.id}
              panel={activePanel.panel}
              dock={activePanel.dock}
            />
          )}
        </DefaultErrorBoundary>
      </div>
    </TabRoot>
  );
});
