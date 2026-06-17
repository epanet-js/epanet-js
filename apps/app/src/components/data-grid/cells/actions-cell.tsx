import clsx from "clsx";
import * as DD from "@radix-ui/react-dropdown-menu";
import { Button, DDContent } from "src/components/elements";
import { MoreActionsIcon } from "src/icons";
import { RowAction } from "../types";

type ActionsCellProps = {
  rowIndex: number;
  actions: RowAction[];
  disabled?: boolean;
};

export function ActionsCell({
  rowIndex,
  actions,
  disabled = false,
}: ActionsCellProps) {
  return (
    <DD.Root>
      <DD.Trigger asChild>
        <Button
          variant="quiet"
          size="sm"
          className="w-full h-full justify-center"
          aria-label="Actions"
          tabIndex={-1}
          disabled={disabled}
        >
          <MoreActionsIcon size="md" />
        </Button>
      </DD.Trigger>
      <DD.Portal>
        <DDContent
          align="end"
          className="z-50 min-w-40"
          onClick={(e) => e.stopPropagation()}
        >
          {actions.map((action, index) => {
            const isDisabled = action.disabled?.(rowIndex) ?? false;
            const isDestructive = action.variant === "destructive";
            return (
              <DD.Item
                key={index}
                className={clsx(
                  "rounded-sm flex items-center w-full h-8 px-3 text-size-base gap-x-2 outline-hidden",
                  isDisabled
                    ? "text-disabled cursor-not-allowed"
                    : isDestructive
                      ? "cursor-pointer text-error hover:bg-error-subtle"
                      : "cursor-pointer hover:bg-base-hover text-default",
                )}
                onSelect={() => !isDisabled && action.onSelect(rowIndex)}
                disabled={isDisabled}
              >
                {action.icon}
                {action.label}
              </DD.Item>
            );
          })}
        </DDContent>
      </DD.Portal>
    </DD.Root>
  );
}
