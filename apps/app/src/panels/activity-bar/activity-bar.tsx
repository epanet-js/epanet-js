import { memo, useCallback } from "react";
import { useAtomValue } from "jotai";
import { selectAtom } from "jotai/utils";
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
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { activePanelIn, panelsIn } from "src/state/panels";
import { splitsAtom } from "src/state/layout";
import { useReorderPanel } from "src/commands/reorder-panel";
import { useToggleLeftPanelTab } from "src/commands/toggle-left-panel-tab";
import { PanelIcon, panelLabel } from "../panel-template";
import { PanelRailTab } from "./panel-rail-tab";

const leftPanelsAtom = panelsIn("left");
const activeLeftPanelAtom = activePanelIn("left");
const leftOpenAtom = selectAtom(splitsAtom, (splits) => splits.leftOpen);

export const ActivityBar = memo(function ActivityBarInner() {
  const isActivityBarOn = useFeatureFlag("FLAG_ACTIVITY_BAR_SWITCHER");
  const panels = useAtomValue(leftPanelsAtom);
  const activePanel = useAtomValue(activeLeftPanelAtom);
  const isOpen = useAtomValue(leftOpenAtom);
  const translate = useTranslate();
  const reorderPanel = useReorderPanel();
  const toggleTab = useToggleLeftPanelTab();

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

  if (!isActivityBarOn || panels.length < 2) return null;

  return (
    <TabRoot
      value={isOpen ? (activePanel?.id ?? "") : ""}
      orientation="vertical"
      activationMode="manual"
      className="flex-none flex bg-popover"
    >
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
                label={panelLabel(entry.panel, entry.renamedTo, { translate })}
                icon={<PanelIcon panel={entry.panel} />}
                onToggle={toggleTab}
              />
            ))}
          </SortableContext>
        </RailTabList>
      </DndContext>
    </TabRoot>
  );
});
