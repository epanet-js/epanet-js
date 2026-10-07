import { useState } from "react";
import { Tooltip } from "@epanet-js/ui-kit";
import { ItemAction, ItemActions } from "./item-actions";
import { Button } from "../elements";

type LabelledItem = {
  id: number;
  label: string;
};

export type ItemSecondaryAction = {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
};

type ListItemProps<T extends LabelledItem> = {
  item: T;
  isSelected: boolean;
  isFocused?: boolean;
  onSelect: (id: number) => void;
  actions?: ItemAction[];
  actionsLabel?: string;
  onAction?: (action: string, item: T) => void;
  secondaryAction?: ItemSecondaryAction;
  icon?: React.ReactNode;
  readOnly?: boolean;
};

export const ListItem = <T extends LabelledItem>({
  item,
  isSelected,
  isFocused = false,
  onSelect,
  actions,
  actionsLabel,
  onAction,
  secondaryAction,
  icon,
  readOnly = false,
}: ListItemProps<T>) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <li
      data-item-id={item.id}
      aria-selected={isSelected}
      className={`group flex items-center justify-between text-sm cursor-pointer h-8 min-w-0 rounded-sm ${
        isSelected
          ? "bg-accent-tint"
          : isFocused || isMenuOpen
            ? "bg-base-hover"
            : "hover:bg-base-hover"
      }`}
    >
      <Button
        variant="quiet/list"
        size="sm"
        onClick={() => onSelect(item.id)}
        className="flex-1 min-w-0 justify-start hover:bg-transparent dark:hover:bg-transparent focus-visible:ring-0! focus-visible:ring-offset-0!"
      >
        {icon && icon}
        <span className="truncate">{item.label}</span>
      </Button>
      {!readOnly && secondaryAction && (
        <div className="self-stretch flex shrink-0">
          <Tooltip
            delayDuration={700}
            content={
              <span className="whitespace-nowrap">{secondaryAction.label}</span>
            }
          >
            <Button
              variant="quiet"
              size="xxs"
              aria-label={secondaryAction.label}
              onClick={secondaryAction.onClick}
              className={`h-6 w-6 self-center justify-center hover:bg-base-hover ${
                isSelected ? "" : "invisible group-hover:visible"
              }`}
            >
              {secondaryAction.icon}
            </Button>
          </Tooltip>
        </div>
      )}
      {!readOnly && actions && onAction && (
        <ItemActions
          label={actionsLabel}
          isSelected={isSelected}
          actions={actions}
          onAction={(action) => onAction(action, item)}
          onOpenChange={setIsMenuOpen}
        />
      )}
    </li>
  );
};
