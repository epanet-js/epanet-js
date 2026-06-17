import * as DD from "@radix-ui/react-dropdown-menu";
import { B3Variant, Button, DDContent, StyledItem } from "../elements";
import { MoreActionsIcon } from "src/icons";

export type ItemAction = {
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
  actions: ItemAction[];
  isSelected: boolean;
  onAction: (name: string) => void;
  onOpenChange: (open: boolean) => void;
}) => {
  const handleOpenChange = (open: boolean) => {
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
            className={`h-6 w-6 self-center aria-expanded:bg-base-hover aria-expanded:visible hover:bg-base-hover ${
              isSelected ? "" : "invisible group-hover:visible"
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
