import { memo, type ReactNode } from "react";
import clsx from "clsx";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { RailTab } from "src/components/rail-tab";

export const PanelRailTab = memo(function PanelRailTab({
  id,
  label,
  icon,
}: {
  id: string;
  label: string;
  icon: ReactNode;
}) {
  const { listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <RailTab
      ref={setNodeRef}
      value={id}
      label={label}
      icon={icon}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={clsx(
        "relative cursor-grab active:cursor-grabbing",
        isDragging && "z-10 opacity-60",
      )}
      {...listeners}
    />
  );
});
