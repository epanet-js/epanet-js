import { useTranslate } from "src/hooks/use-translate";
import { Pattern, PatternId, PatternType } from "src/hydraulic-model";
import {
  ChevronRightIcon,
  CloseIcon,
  DuplicateIcon,
  RenameIcon,
} from "src/icons";
import { ItemAction, ItemInput, ListItem } from "src/components/list";

export type SectionType = Extract<
  PatternType,
  "demand" | "reservoirHead" | "pumpSpeed"
>;

export type TypedPattern = Pattern & { type: SectionType };

export type ActionState =
  | { action: "creating"; patternType: PatternType }
  | { action: "renaming"; patternId: PatternId }
  | { action: "cloning"; sourcePattern: TypedPattern };

export type PatternSidebarItemProps = {
  pattern: TypedPattern;
  isSelected: boolean;
  onSelect: () => void;
  actionState: ActionState | undefined;
  onCancel: () => void;
  onStartRename: (patternId: PatternId) => void;
  onStartClone: (pattern: TypedPattern) => void;
  onDelete: () => void;
  onPatternLabelChange: (name: string) => boolean;
  readOnly?: boolean;
};

export const PatternSidebarItem = ({
  pattern,
  isSelected,
  onSelect,
  actionState,
  onCancel,
  onStartRename,
  onStartClone,
  onDelete,
  onPatternLabelChange,
  readOnly = false,
}: PatternSidebarItemProps) => {
  const translate = useTranslate();

  const actions: ItemAction[] = [
    {
      action: "rename",
      label: translate("rename"),
      icon: <RenameIcon size="sm" />,
    },
    {
      action: "duplicate",
      label: translate("duplicate"),
      icon: <CloseIcon size="sm" />,
    },
    {
      action: "delete",
      label: translate("delete"),
      icon: <DuplicateIcon size="sm" />,
      variant: "destructive",
    },
  ];

  const handleAction = (action: string) => {
    switch (action) {
      case "rename":
        return onStartRename(pattern.id);
      case "duplicate":
        return onStartClone(pattern);
      case "delete":
        return onDelete();
    }
  };

  const isRenaming =
    actionState?.action === "renaming" && actionState.patternId === pattern.id;
  const isCloning =
    actionState?.action === "cloning" &&
    actionState.sourcePattern.id === pattern.id;

  if (isRenaming) {
    return (
      <ItemInput
        label="Rename pattern"
        value={pattern.label}
        onCommit={onPatternLabelChange}
        onCancel={onCancel}
      />
    );
  }

  return (
    <>
      <ListItem
        id={pattern.id}
        label={pattern.label}
        isSelected={isSelected}
        onSelect={onSelect}
        actions={readOnly ? undefined : actions}
        onAction={readOnly ? undefined : handleAction}
      />
      {isCloning && (
        <ItemInput
          label="Clone pattern name"
          value={pattern.label}
          placeholder={translate("patterns.patternName")}
          onCommit={onPatternLabelChange}
          onCancel={onCancel}
          forceValidation
        />
      )}
    </>
  );
};

export type UncategorizedPatternSidebarItemProps = {
  pattern: Pattern;
  isSelected: boolean;
  onSelect: () => void;
  onCategorize: (patternId: PatternId, type: SectionType) => void;
  onDelete: () => void;
  readOnly?: boolean;
};

export const UncategorizedPatternSidebarItem = ({
  pattern,
  isSelected,
  onSelect,
  onCategorize,
  onDelete,
  readOnly = false,
}: UncategorizedPatternSidebarItemProps) => {
  const translate = useTranslate();

  const actions: ItemAction[] = [
    {
      action: "setAsDemand",
      label: translate("patterns.setAsDemand"),
      icon: <ChevronRightIcon size="sm" />,
    },
    {
      action: "setAsReservoirHead",
      label: translate("patterns.setAsReservoirHead"),
      icon: <ChevronRightIcon size="sm" />,
    },
    {
      action: "setAsPumpSpeed",
      label: translate("patterns.setAsPumpSpeed"),
      icon: <ChevronRightIcon size="sm" />,
    },
    {
      action: "delete",
      label: translate("delete"),
      icon: <DuplicateIcon size="sm" />,
      variant: "destructive",
    },
  ];

  const handleAction = (action: string) => {
    switch (action) {
      case "setAsDemand":
        return onCategorize(pattern.id, "demand");
      case "setAsReservoirHead":
        return onCategorize(pattern.id, "reservoirHead");
      case "setAsPumpSpeed":
        return onCategorize(pattern.id, "pumpSpeed");
      case "delete":
        return onDelete();
    }
  };

  return (
    <ListItem
      id={pattern.id}
      label={pattern.label}
      isSelected={isSelected}
      onSelect={onSelect}
      actions={readOnly ? undefined : actions}
      onAction={readOnly ? undefined : handleAction}
    />
  );
};
