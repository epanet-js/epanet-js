import { memo, useCallback } from "react";
import { useAtomValue } from "jotai";
import { Tab, TabList, TabRoot } from "src/components/tab";
import { DefaultErrorBoundary } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { type PlacedPanel, activePanelIn, panelsIn } from "src/state/panels";
import { useActivatePanel } from "src/commands/activate-panel";
import { panelLabel } from "../panel-template";
import { PanelContent } from "../panel-template";

const leftPanelsAtom = panelsIn("left");
const activeLeftPanelAtom = activePanelIn("left");

export const LeftDock = memo(function LeftDockInner() {
  const panels = useAtomValue(leftPanelsAtom);
  const activePanel = useAtomValue(activeLeftPanelAtom);
  const activatePanel = useActivatePanel();
  const translate = useTranslate();

  const labelOf = useCallback(
    (entry: PlacedPanel) =>
      panelLabel(entry.panel, entry.renamedTo, { translate }),
    [translate],
  );

  if (panels.length === 0) return null;

  return (
    <TabRoot
      value={activePanel?.id ?? undefined}
      onValueChange={activatePanel}
      className="absolute inset-0 flex flex-col"
    >
      {panels.length > 1 && (
        <TabList>
          {panels.map((entry) => (
            <Tab key={entry.id} value={entry.id}>
              {labelOf(entry)}
            </Tab>
          ))}
        </TabList>
      )}
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
