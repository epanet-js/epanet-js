import { useState } from "react";
import * as DD from "@radix-ui/react-dropdown-menu";
import { B3Variant, Button, DDContent, StyledItem } from "../elements";
import { MoreActionsIcon } from "src/icons";

export type IAction = {
  action: string;
  label: string;
  variant?: B3Variant;
  icon?: React.ReactNode;
};

export const ItemActions = ({
  actions,
  isSelected,
  onAction,
  onOpenChange,
}: {
  actions: IAction[];
  isSelected: boolean;
  onAction: (name: string) => void;
  onOpenChange: (open: boolean) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    onOpenChange(open);
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="self-stretch flex pr-1"
    >
      <DD.Root modal={false} onOpenChange={handleOpenChange}>
        <DD.Trigger asChild>
          <Button
            variant="quiet"
            size="xs"
            aria-label="Actions"
            className={`h-6 w-6 self-center ${
              isSelected
                ? "hover:bg-white/30 dark:hover:bg-white/10"
                : isOpen
                  ? "hover:bg-gray-200 dark:hover:bg-gray-700"
                  : "invisible group-hover:visible hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            <MoreActionsIcon size="sm" />
          </Button>
        </DD.Trigger>
        <DD.Portal>
          <DDContent align="start" side="bottom" className="z-50">
            {actions.map(({ action, label, icon, variant }) => (
              <StyledItem
                key={action}
                variant={variant}
                onSelect={() => onAction(action)}
              >
                {icon && icon}
                {label}
              </StyledItem>
            ))}
          </DDContent>
        </DD.Portal>
      </DD.Root>
    </div>
  );
};
