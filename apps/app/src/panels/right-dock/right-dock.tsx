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
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { TabRoot } from "src/components/tab";
import { RailTabList } from "src/components/rail-tab";
import { DefaultErrorBoundary } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { type PlacedPanel, activePanelIn, panelsIn } from "src/state/panels";
import { useActivatePanel } from "src/commands/activate-panel";
import { useReorderPanel } from "src/commands/reorder-panel";
import { useUserTracking } from "src/infra/user-tracking";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { panelTrackingName } from "../panel";
import { PanelIcon, panelLabel } from "../panel-template";
import { PanelContent } from "../panel-template";
import { PanelRailTab } from "../left-dock/panel-rail-tab";
import { SideTabList } from "./side-tab-list";

const rightPanelsAtom = panelsIn("right");
const activeRightPanelAtom = activePanelIn("right");

export const RightDock = memo(function RightDockInner() {
  const panels = useAtomValue(rightPanelsAtom);
  const activePanel = useAtomValue(activeRightPanelAtom);
  const activatePanel = useActivatePanel();
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const reorderPanel = useReorderPanel();
  const isAssetPanelAloneOn = useFeatureFlag("FLAG_ASSET_PANEL_ALONE");

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

  if (!isAssetPanelAloneOn) {
    return (
      <div className="absolute inset-0 flex flex-col">
        {panels.length > 1 && (
          <SideTabList
            tabs={panels.map((entry) => ({
              id: entry.id,
              label: labelOf(entry),
            }))}
            activeId={activePanel?.id}
            onSelect={handleTabChange}
          />
        )}
        {content}
      </div>
    );
  }

  return (
    <TabRoot
      value={activePanel?.id ?? undefined}
      onValueChange={handleTabChange}
      orientation="vertical"
      className="absolute inset-0 flex flex-row"
    >
      {content}
      {panels.length > 1 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <RailTabList side="right">
            <SortableContext
              items={panels}
              strategy={verticalListSortingStrategy}
            >
              {panels.map((entry) => (
                <PanelRailTab
                  key={entry.id}
                  id={entry.id}
                  side="right"
                  label={labelOf(entry)}
                  icon={<PanelIcon panel={entry.panel} />}
                />
              ))}
            </SortableContext>
          </RailTabList>
        </DndContext>
      )}
    </TabRoot>
  );
});
