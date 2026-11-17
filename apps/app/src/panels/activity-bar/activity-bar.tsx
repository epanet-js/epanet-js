import { memo } from "react";
import { useAtomValue } from "jotai";
import { selectAtom } from "jotai/utils";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { TabRoot } from "src/components/tab";
import { RailTabList } from "src/components/rail-tab";
import { useTranslate } from "src/hooks/use-translate";
import { activePanelIn, panelsIn } from "src/state/panels";
import { splitsAtom } from "src/state/layout";
import { useToggleLeftPanelTab } from "src/commands/toggle-left-panel-tab";
import { PanelIcon, panelLabel } from "../panel-template";
import { PanelRailTab } from "./panel-rail-tab";
import { useTabReorder } from "../dock-tabs/dock-tabs";

const leftPanelsAtom = panelsIn("left");
const activeLeftPanelAtom = activePanelIn("left");
const leftOpenAtom = selectAtom(splitsAtom, (splits) => splits.leftOpen);

export const ActivityBar = memo(function ActivityBarInner() {
  const panels = useAtomValue(leftPanelsAtom);
  const activePanel = useAtomValue(activeLeftPanelAtom);
  const isOpen = useAtomValue(leftOpenAtom);
  const translate = useTranslate();
  const toggleTab = useToggleLeftPanelTab();
  const { sensors, onDragEnd } = useTabReorder();

  if (panels.length < 2) return null;

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
        onDragEnd={onDragEnd}
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
