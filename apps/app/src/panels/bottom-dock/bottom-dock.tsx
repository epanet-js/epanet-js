import { memo, useCallback } from "react";
import clsx from "clsx";
import { useAtomValue } from "jotai";
import { TabRoot, TabList, Tab } from "src/components/tab";
import { DefaultErrorBoundary } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { panelTrackingName } from "../panel";
import { type PlacedPanel, activePanelIn, panelsIn } from "src/state/panels";
import { useActivatePanel } from "src/commands/activate-panel";
import { useClosePanel } from "src/commands/close-panel";
import { useIsPanelClosable } from "../use-panel-closable";
import { useUserTracking } from "src/infra/user-tracking";
import { panelLabel } from "../panel-template";
import { PanelCloseButton } from "../panel-close-button";
import { PanelContent } from "../panel-template";
import { DockEmptyState } from "../dock-empty-state";

const bottomPanelsAtom = panelsIn("bottom");
const activeBottomPanelAtom = activePanelIn("bottom");

export const BottomDock = memo(function BottomDockInner() {
  const panels = useAtomValue(bottomPanelsAtom);
  const activePanel = useAtomValue(activeBottomPanelAtom);
  const activatePanel = useActivatePanel();
  const translate = useTranslate();
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const closePanel = useClosePanel();
  const isClosable = useIsPanelClosable();
  const userTracking = useUserTracking();

  const labelOf = useCallback(
    (entry: PlacedPanel) =>
      panelLabel(entry.panel, entry.renamedTo, { translate, hydraulicModel }),
    [translate, hydraulicModel],
  );

  const handleTabChange = useCallback(
    (panelId: string) => {
      const entry = panels.find((placed) => placed.id === panelId);
      if (entry && panelId !== activePanel?.id) {
        userTracking.capture({
          name: "bottomPanel.tabSwitched",
          panelType: panelTrackingName(entry.panel),
        });
      }
      activatePanel(panelId);
    },
    [activePanel, activatePanel, panels, userTracking],
  );

  if (panels.length === 0) return <DockEmptyState />;

  return (
    <TabRoot
      value={activePanel?.id ?? undefined}
      onValueChange={handleTabChange}
      className="absolute inset-0 flex flex-col"
    >
      <TabList>
        {panels.map((entry) => (
          <Tab
            key={entry.id}
            value={entry.id}
            className={clsx("relative group", isClosable(entry) && "pr-7")}
          >
            {labelOf(entry)}
            {isClosable(entry) && (
              <PanelCloseButton
                panelLabel={labelOf(entry)}
                onClose={() => closePanel(entry.id)}
              />
            )}
          </Tab>
        ))}
      </TabList>
      <div className="flex-1 min-h-0 flex flex-col relative">
        <DefaultErrorBoundary>
          {activePanel && (
            <PanelContent key={activePanel.id} panel={activePanel.panel} />
          )}
        </DefaultErrorBoundary>
      </div>
    </TabRoot>
  );
});
