import { useState } from "react";
import { ItemAction, ItemActions } from "./item-actions";
import { Button } from "../elements";

type LabelledItem = {
  id: number;
  label: string;
};

type ListItemProps<T extends LabelledItem> = {
  item: T;
  isSelected: boolean;
  onSelect: (id: number) => void;
  actions?: ItemAction[];
  onAction?: (action: string, item: T) => void;
  icon?: React.ReactNode;
  readOnly?: boolean;
};

export const ListItem = <T extends LabelledItem>({
  item,
  isSelected,
  onSelect,
  actions,
  onAction,
  icon,
  readOnly = false,
}: ListItemProps<T>) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <li
      data-item-id={item.id}
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
        onClick={() => onSelect(item.id)}
        className="flex-1 min-w-0 justify-start hover:bg-transparent dark:hover:bg-transparent focus-visible:!ring-0 focus-visible:!ring-offset-0"
      >
        {icon && icon}
        <span className="truncate">{item.label}</span>
      </Button>
      {!readOnly && actions && onAction && (
        <ItemActions
          isSelected={isSelected}
          actions={actions}
          onAction={(action) => onAction(action, item)}
          onOpenChange={setIsMenuOpen}
        />
      )}
    </li>
  );
};
