import { memo, useCallback } from "react";
import { useAtomValue } from "jotai";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { TabRoot, TabList } from "src/components/tab";
import { DefaultErrorBoundary } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { type PlacedPanel, activePanelIn, panelsIn } from "src/state/panels";
import { useActivatePanel } from "src/commands/activate-panel";
import { useClosePanel } from "src/commands/close-panel";
import { useReorderPanel } from "src/commands/reorder-panel";
import { useUserTracking } from "src/infra/user-tracking";
import { panelTrackingName } from "../panel";
import { panelDescription, panelLabel } from "../panel-template";
import { PanelContent } from "../panel-template";
import { PanelTab } from "../bottom-dock/panel-tab";

const rightPanelsAtom = panelsIn("right");
const activeRightPanelAtom = activePanelIn("right");

export const RightDock = memo(function RightDockInner() {
  const panels = useAtomValue(rightPanelsAtom);
  const activePanel = useAtomValue(activeRightPanelAtom);
  const activatePanel = useActivatePanel();
  const translate = useTranslate();
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const closePanel = useClosePanel();
  const userTracking = useUserTracking();
  const reorderPanel = useReorderPanel();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return;
      reorderPanel(String(active.id), String(over.id));
    },
    [reorderPanel],
  );

  const labelOf = useCallback(
    (entry: PlacedPanel) =>
      panelLabel(entry.panel, entry.renamedTo, { translate }),
    [translate],
  );

  const descriptionOf = useCallback(
    (entry: PlacedPanel) =>
      panelDescription(entry.panel, { translate, hydraulicModel }),
    [translate, hydraulicModel],
  );

  const handleTabChange = useCallback(
    (panelId: string) => {
      const entry = panels.find((placed) => placed.id === panelId);
      if (entry && panelId !== activePanel?.id) {
        userTracking.capture({
          name: "rightPanel.tabSwitched",
          panelType: panelTrackingName(entry.panel),
        });
      }
      activatePanel(panelId);
    },
    [activePanel, activatePanel, panels, userTracking],
  );

  if (panels.length === 0) return null;

  return (
    <TabRoot
      value={activePanel?.id ?? undefined}
      onValueChange={handleTabChange}
      className="absolute inset-0 flex flex-col"
    >
      {panels.length > 1 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToHorizontalAxis]}
          onDragEnd={handleDragEnd}
        >
          <TabList>
            <SortableContext
              items={panels}
              strategy={horizontalListSortingStrategy}
            >
              {panels.map((entry) => (
                <PanelTab
                  key={entry.id}
                  id={entry.id}
                  label={labelOf(entry)}
                  description={descriptionOf(entry)}
                  closable={entry.closable}
                  onClose={closePanel}
                />
              ))}
            </SortableContext>
          </TabList>
        </DndContext>
      )}
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
