import { ItemAction } from "./item-actions";
import { ItemInput } from "./item-input";
import { ListItem } from "./list-item";

type LabelledItem = {
  id: number;
  label: string;
};

type EditableListItemProps<T extends LabelledItem> = {
  item: T;
  isSelected: boolean;
  onSelect: (id: number) => void;
  actions?: ItemAction[];
  onAction?: (action: string, item: T) => void;
  icon?: React.ReactNode;
  editLabelMode?: "inline" | "below" | null;
  placeholder?: string;
  sanitize?: (raw: string) => string;
  onLabelChange: (name: string) => boolean;
  onCancel: () => void;
  readOnly?: boolean;
};

export const EditableListItem = <T extends LabelledItem>({
  item,
  isSelected,
  onSelect,
  actions,
  onAction,
  editLabelMode,
  placeholder,
  sanitize,
  onLabelChange,
  onCancel,
  icon,
  readOnly = false,
}: EditableListItemProps<T>) => {
  if (editLabelMode === "inline") {
    return (
      <ItemInput
        value={item.label}
        placeholder={placeholder}
        sanitize={sanitize}
        onCommit={onLabelChange}
        onCancel={onCancel}
      />
    );
  }

  return (
    <>
      <ListItem
        item={item}
        isSelected={isSelected}
        onSelect={onSelect}
        icon={icon}
        actions={actions}
        onAction={onAction}
        readOnly={readOnly}
      />
      {editLabelMode === "below" && (
        <ItemInput
          value={item.label}
          placeholder={placeholder}
          sanitize={sanitize}
          onCommit={onLabelChange}
          onCancel={onCancel}
          forceValidation
        />
      )}
    </>
  );
};
