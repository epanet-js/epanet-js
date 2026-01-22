import { CellComponent, Column } from "react-datasheet-grid";
import * as DD from "@radix-ui/react-dropdown-menu";
import { MoreActionsIcon } from "src/icons";
import { Button } from "../../elements";

export type RowAction = {
  label: string;
  icon: React.ReactNode;
  onSelect: (rowIndex: number) => void;
  disabled?: (rowIndex: number) => boolean;
};

type ActionsCellProps = {
  actions: RowAction[];
};

const ActionsCell: CellComponent<null, ActionsCellProps> = ({
  rowIndex,
  columnData,
}) => {
  const { actions } = columnData;

  return (
    <DD.Root>
      <DD.Trigger asChild>
        <Button
          variant="quiet"
          size="sm"
          className="w-full h-full justify-center"
          aria-label="Actions"
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
};

export const createActionsColumn = (
  actions: RowAction[],
): Partial<Column<null, ActionsCellProps, string>> => ({
  component: ActionsCell,
  columnData: { actions },
  basis: 32,
  grow: 0,
  shrink: 0,
  disableKeys: true,
  disabled: true,
});
