import { memo } from "react";
import clsx from "clsx";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Tab } from "src/components/tab";
import { PanelCloseButton } from "../panel-close-button";

export const PanelTab = memo(function PanelTab({
  id,
  label,
  closable,
  onClose,
}: {
  id: string;
  label: string;
  closable: boolean;
  onClose: (panelId: string) => void;
}) {
  const { listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <Tab
      ref={setNodeRef}
      value={id}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={clsx(
        "relative group cursor-grab active:cursor-grabbing",
        closable && "pr-7",
        isDragging && "z-10 opacity-60",
      )}
      {...listeners}
    >
      {label}
      {closable && (
        <PanelCloseButton panelLabel={label} onClose={() => onClose(id)} />
      )}
    </Tab>
  );
});
