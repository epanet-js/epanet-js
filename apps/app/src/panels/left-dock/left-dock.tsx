import { memo, useCallback } from "react";
import { useAtomValue } from "jotai";
import { Tab, TabList, TabRoot } from "src/components/tab";
import { DefaultErrorBoundary } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { type PlacedPanel, activePanelIn, panelsIn } from "src/state/panels";
import { useActivatePanel } from "src/commands/activate-panel";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useUserTracking } from "src/infra/user-tracking";
import { panelTrackingName } from "../panel";
import { panelLabel } from "../panel-template";
import { PanelContent } from "../panel-template";

const leftPanelsAtom = panelsIn("left");
const activeLeftPanelAtom = activePanelIn("left");

export const LeftDock = memo(function LeftDockInner() {
  const panels = useAtomValue(leftPanelsAtom);
  const activePanel = useAtomValue(activeLeftPanelAtom);
  const activatePanel = useActivatePanel();
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const isActivityBarOn = useFeatureFlag("FLAG_ACTIVITY_BAR_SWITCHER");

  const labelOf = useCallback(
    (entry: PlacedPanel) =>
      panelLabel(entry.panel, entry.renamedTo, { translate }),
    [translate],
  );

  const handleTabChange = useCallback(
    (panelId: string) => {
      const entry = panels.find((placed) => placed.id === panelId);
      if (entry && panelId !== activePanel?.id) {
        userTracking.capture({
          name: "leftPanel.tabSwitched",
          panelType: panelTrackingName(entry.panel),
        });
      }
      activatePanel(panelId);
    },
    [activePanel, activatePanel, panels, userTracking],
  );

  if (panels.length === 0) return null;

  const content = (
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
  );

  if (isActivityBarOn) {
    return <div className="absolute inset-0 flex flex-col">{content}</div>;
  }

  return (
    <TabRoot
      value={activePanel?.id ?? undefined}
      onValueChange={handleTabChange}
      className="absolute inset-0 flex flex-col"
    >
      {panels.length > 1 && (
        <TabList className="border">
          {panels.map((entry) => (
            <Tab key={entry.id} value={entry.id}>
              {labelOf(entry)}
            </Tab>
          ))}
        </TabList>
      )}
      {content}
    </TabRoot>
  );
});
