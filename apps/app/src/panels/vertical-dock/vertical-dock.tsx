import { memo } from "react";
import { useAtomValue } from "jotai";
import { TabRoot } from "src/components/tab";
import { DefaultErrorBoundary } from "src/components/elements";
import { activePanelIn, panelsIn } from "src/state/panels";
import { PanelContent } from "../panel-template";
import { DockEmptyState } from "../dock-empty-state";
import { DockTabStrip, useDockTabChange } from "../dock-tabs/dock-tabs";

const verticalPanelsAtom = panelsIn("vertical");
const activeVerticalPanelAtom = activePanelIn("vertical");

export const VerticalDock = memo(function VerticalDockInner() {
  const panels = useAtomValue(verticalPanelsAtom);
  const activePanel = useAtomValue(activeVerticalPanelAtom);
  const handleTabChange = useDockTabChange(
    panels,
    activePanel,
    "verticalPanel.tabSwitched",
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
