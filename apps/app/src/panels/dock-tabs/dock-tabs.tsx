import { useCallback } from "react";
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
import { TabList } from "src/components/tab";
import { useTranslate } from "src/hooks/use-translate";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import type { PlacedPanel } from "src/state/panels";
import { useActivatePanel } from "src/commands/activate-panel";
import { useClosePanel } from "src/commands/close-panel";
import { useReorderPanel } from "src/commands/reorder-panel";
import { useUserTracking } from "src/infra/user-tracking";
import { panelTrackingName } from "../panel";
import { panelDescription, panelLabel } from "../panel-template";
import { PanelTab } from "./panel-tab";

export const useTabReorder = () => {
  const reorderPanel = useReorderPanel();

  // A plain click must still switch tabs: the drag only takes over once the
  // pointer has travelled far enough to mean it.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const onDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return;
      reorderPanel(String(active.id), String(over.id));
    },
    [reorderPanel],
  );

  return { sensors, onDragEnd };
};

type TabSwitchedEvent =
  | "bottomPanel.tabSwitched"
  | "rightPanel.tabSwitched"
  | "verticalPanel.tabSwitched";

export const useDockTabChange = (
  panels: PlacedPanel[],
  activePanel: PlacedPanel | null,
  eventName: TabSwitchedEvent,
) => {
  const activatePanel = useActivatePanel();
  const userTracking = useUserTracking();

  return useCallback(
    (panelId: string) => {
      const entry = panels.find((placed) => placed.id === panelId);
      if (entry && panelId !== activePanel?.id) {
        userTracking.capture({
          name: eventName,
          panelType: panelTrackingName(entry.panel),
        });
      }
      activatePanel(panelId);
    },
    [activePanel, activatePanel, panels, userTracking, eventName],
  );
};

export const DockTabStrip = ({ panels }: { panels: PlacedPanel[] }) => {
  const translate = useTranslate();
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const closePanel = useClosePanel();
  const { sensors, onDragEnd } = useTabReorder();

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToHorizontalAxis]}
      onDragEnd={onDragEnd}
    >
      <TabList className="border-b">
        <SortableContext
          items={panels}
          strategy={horizontalListSortingStrategy}
        >
          {panels.map((entry) => (
            <PanelTab
              key={entry.id}
              id={entry.id}
              label={panelLabel(entry.panel, entry.renamedTo, { translate })}
              description={panelDescription(entry.panel, {
                translate,
                hydraulicModel,
              })}
              closable={entry.closable}
              onClose={closePanel}
            />
          ))}
        </SortableContext>
      </TabList>
    </DndContext>
  );
};
