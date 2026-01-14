import { CellComponent, Column } from "react-datasheet-grid";
import * as DD from "@radix-ui/react-dropdown-menu";
import { MoreActionsIcon } from "src/icons";

export type RowAction = {
  label: string;
  icon: React.ReactNode;
  onSelect: (rowIndex: number) => void;
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
        <button
          type="button"
          className="flex items-center justify-center w-full h-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          aria-label="Actions"
        >
          <MoreActionsIcon size="md" />
        </button>
      </DD.Trigger>
      <DD.Portal>
        <DD.Content
          className="bg-white border rounded-md shadow-md z-50 min-w-[160px]"
          align="end"
        >
          {actions.map((action, index) => (
            <DD.Item
              key={index}
              className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 outline-none"
              onSelect={() => action.onSelect(rowIndex)}
            >
              {action.icon}
              {action.label}
            </DD.Item>
          ))}
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
