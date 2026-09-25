import { memo } from "react";
import { useAtomValue } from "jotai";
import { DefaultErrorBoundary } from "src/components/elements";
import { activePanelIn, panelsIn } from "src/state/panels";
import { PanelContent } from "../panel-template";

const leftPanelsAtom = panelsIn("left");
const activeLeftPanelAtom = activePanelIn("left");

export const LeftDock = memo(function LeftDockInner() {
  const panels = useAtomValue(leftPanelsAtom);
  const activePanel = useAtomValue(activeLeftPanelAtom);

  if (panels.length === 0) return null;

  return (
    <div className="absolute inset-0 flex flex-col">
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
    </div>
  );
});
