import * as DD from "@radix-ui/react-dropdown-menu";
import {
  B3Variant,
  Button,
  DDContent,
  DDSubContent,
  DDSubTriggerItem,
  StyledItem,
} from "../elements";
import { ChevronRightIcon, MoreActionsIcon } from "src/icons";

export type ItemAction = {
  action: string;
  label: string;
  variant?: B3Variant;
  icon?: React.ReactNode;
  disabled?: boolean;
  children?: ItemAction[];
};

const renderAction = (
  { action, label, icon, variant, disabled, children }: ItemAction,
  onAction: (name: string) => void,
) =>
  children ? (
    <DD.Sub key={action}>
      <DDSubTriggerItem
        variant={variant}
        disabled={disabled}
        className={disabled ? "opacity-60" : undefined}
      >
        {icon && icon}
        {label}
        <ChevronRightIcon size="sm" className="ml-auto" />
      </DDSubTriggerItem>
      <DD.Portal>
        <DDSubContent sideOffset={4} alignOffset={-4} className="z-50">
          {children.map((child) => renderAction(child, onAction))}
        </DDSubContent>
      </DD.Portal>
    </DD.Sub>
  ) : (
    <StyledItem
      key={action}
      variant={variant}
      disabled={disabled}
      className={disabled ? "opacity-60" : undefined}
      onSelect={() => onAction(action)}
    >
      {icon && icon}
      {label}
    </StyledItem>
  );

export const ItemActions = ({
  label = "Actions",
  actions,
  isSelected,
  onAction,
  onOpenChange,
}: {
  label?: string;
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
      className="self-stretch flex shrink-0 pr-1"
    >
      <DD.Root modal={false} onOpenChange={handleOpenChange}>
        <DD.Trigger asChild>
          <Button
            variant="quiet"
            size="xxs"
            aria-label={label}
            className={`h-6 w-6 self-center justify-center aria-expanded:bg-base-hover aria-expanded:visible hover:bg-base-hover ${
              isSelected ? "" : "invisible group-hover:visible"
            }`}
          >
            <MoreActionsIcon size="md" />
          </Button>
        </DD.Trigger>
        <DD.Portal>
          <DDContent align="start" side="bottom" className="z-50">
            {actions.map((action) => renderAction(action, onAction))}
          </DDContent>
        </DD.Portal>
      </DD.Root>
    </div>
  );
};
