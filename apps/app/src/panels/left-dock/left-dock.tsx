import { memo, useCallback } from "react";
import { useAtomValue } from "jotai";
import clsx from "clsx";
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
import { Tab, TabList, TabRoot } from "src/components/tab";
import { DefaultErrorBoundary } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { type PlacedPanel, activePanelIn, panelsIn } from "src/state/panels";
import { useActivatePanel } from "src/commands/activate-panel";
import { useReorderPanel } from "src/commands/reorder-panel";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useUserTracking } from "src/infra/user-tracking";
import { panelTrackingName } from "../panel";
import { PanelIcon, panelLabel } from "../panel-template";
import { PanelContent } from "../panel-template";
import { RailTabList } from "src/components/rail-tab";
import { PanelRailTab } from "./panel-rail-tab";

const leftPanelsAtom = panelsIn("left");
const activeLeftPanelAtom = activePanelIn("left");

export const LeftDock = memo(function LeftDockInner() {
  const panels = useAtomValue(leftPanelsAtom);
  const activePanel = useAtomValue(activeLeftPanelAtom);
  const activatePanel = useActivatePanel();
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const isActivityBarOn = useFeatureFlag("FLAG_ACTIVITY_BAR_SWITCHER");
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

  return (
    <TabRoot
      value={activePanel?.id ?? undefined}
      onValueChange={handleTabChange}
      orientation={isActivityBarOn ? "vertical" : "horizontal"}
      className={clsx(
        "absolute inset-0 flex",
        isActivityBarOn ? "flex-row" : "flex-col",
      )}
    >
      {panels.length > 1 &&
        (isActivityBarOn ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
          >
            <RailTabList>
              <SortableContext
                items={panels}
                strategy={verticalListSortingStrategy}
              >
                {panels.map((entry) => (
                  <PanelRailTab
                    key={entry.id}
                    id={entry.id}
                    label={labelOf(entry)}
                    icon={<PanelIcon panel={entry.panel} />}
                  />
                ))}
              </SortableContext>
            </RailTabList>
          </DndContext>
        ) : (
          <TabList className="border">
            {panels.map((entry) => (
              <Tab key={entry.id} value={entry.id}>
                {labelOf(entry)}
              </Tab>
            ))}
          </TabList>
        ))}
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
