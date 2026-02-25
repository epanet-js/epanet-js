import { useState } from "react";
import { ItemAction, ItemActions } from "./item-actions";
import { Button } from "../elements";

type ListItemProps = {
  id: number;
  label: string;
  isSelected: boolean;
  onSelect: (id: number) => void;
  actions?: ItemAction[];
  onAction?: (action: string, id: number) => void;
  icon?: React.ReactNode;
};

export const ListItem = ({
  id,
  label,
  isSelected,
  onSelect,
  actions,
  onAction,
  icon,
}: ListItemProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <li
      data-item-id={id}
      className={`group flex items-center justify-between text-sm cursor-pointer h-8 min-w-0 ${
        isSelected
          ? "bg-gray-200 dark:hover:bg-gray-700"
          : isMenuOpen
            ? "bg-gray-100 dark:bg-gray-800"
            : "hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
    >
      <Button
        variant="quiet/list"
        size="sm"
        onClick={() => onSelect(id)}
        className="flex-1 min-w-0 justify-start hover:bg-transparent dark:hover:bg-transparent focus-visible:!ring-0 focus-visible:!ring-offset-0"
      >
        {icon && icon}
        <span className="truncate">{label}</span>
      </Button>
      {actions && onAction && (
        <ItemActions
          isSelected={isSelected}
          actions={actions}
          onAction={(action) => onAction(action, id)}
          onOpenChange={setIsMenuOpen}
        />
      )}
    </li>
  );
};
