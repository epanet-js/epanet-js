import * as DD from "@radix-ui/react-dropdown-menu";
import { Button } from "src/components/elements";
import { MoreActionsIcon } from "src/icons";
import { RowAction } from "../types";

type ActionsCellProps = {
  rowIndex: number;
  actions: RowAction[];
};

export function ActionsCell({ rowIndex, actions }: ActionsCellProps) {
  return (
    <DD.Root>
      <DD.Trigger asChild>
        <Button
          variant="quiet"
          size="sm"
          className="w-full h-full justify-center"
          aria-label="Actions"
          tabIndex={-1}
        >
          <MoreActionsIcon size="md" />
        </Button>
      </DD.Trigger>
      <DD.Portal>
        <DD.Content
          className="bg-white border rounded-md shadow-md z-50 min-w-[160px]"
          align="end"
          onClick={(e) => e.stopPropagation()}
        >
          {actions.map((action, index) => {
            const isDisabled = action.disabled?.(rowIndex) ?? false;
            return (
              <DD.Item
                key={index}
                className={`flex items-center gap-2 px-3 py-2 text-sm outline-none ${
                  isDisabled
                    ? "text-gray-400 cursor-not-allowed"
                    : "cursor-pointer hover:bg-gray-100"
                }`}
                onSelect={() => !isDisabled && action.onSelect(rowIndex)}
                disabled={isDisabled}
              >
                {action.icon}
                {action.label}
              </DD.Item>
            );
          })}
        </DD.Content>
      </DD.Portal>
    </DD.Root>
  );
}
