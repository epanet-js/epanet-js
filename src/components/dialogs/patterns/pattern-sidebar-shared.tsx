import { useState } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { Pattern, PatternId, PatternType } from "src/hydraulic-model";
import {
  ChevronRightIcon,
  CloseIcon,
  DuplicateIcon,
  RenameIcon,
} from "src/icons";
import { Button } from "src/components/elements";
import { ItemInput } from "src/components/list/item-input";
import { IAction, ItemActions } from "src/components/list/item-actions";

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
      <li
        data-pattern-id={pattern.id}
        className={`group flex items-center justify-between text-sm cursor-pointer h-8 min-w-0 ${
          isSelected
            ? "bg-purple-300/40"
            : isMenuOpen
              ? "bg-gray-100 dark:bg-gray-800"
              : "hover:bg-gray-100 dark:hover:bg-gray-800"
        }`}
      >
        <Button
          variant="quiet/list"
          size="sm"
          onClick={onSelect}
          className="flex-1 min-w-0 justify-start hover:bg-transparent dark:hover:bg-transparent focus-visible:!ring-0 focus-visible:!ring-offset-0"
        >
          <span className="truncate">{pattern.label}</span>
        </Button>
        {!readOnly && (
          <PatternActionsMenu
            isSelected={isSelected}
            onRename={() => onStartRename(pattern.id)}
            onDuplicate={() => onStartClone(pattern)}
            onDelete={onDelete}
            onOpenChange={setIsMenuOpen}
          />
        )}
      </li>
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  return (
    <li
      data-pattern-id={pattern.id}
      className={`group flex items-center justify-between text-sm cursor-pointer h-8 min-w-0 ${
        isSelected
          ? "bg-purple-300/40"
          : isMenuOpen
            ? "bg-gray-100 dark:bg-gray-800"
            : "hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
    >
      <Button
        variant="quiet/list"
        size="sm"
        onClick={onSelect}
        className="flex-1 min-w-0 justify-start hover:bg-transparent dark:hover:bg-transparent focus-visible:!ring-0 focus-visible:!ring-offset-0"
      >
        <span className="truncate">{pattern.label}</span>
      </Button>
      {!readOnly && (
        <CategorizeActionsMenu
          isSelected={isSelected}
          onCategorize={(type) => onCategorize(pattern.id, type)}
          onDelete={onDelete}
          onOpenChange={setIsMenuOpen}
        />
      )}
    </li>
  );
};

type PatternActionsMenuProps = {
  isSelected: boolean;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onOpenChange: (open: boolean) => void;
};

const PatternActionsMenu = ({
  isSelected,
  onRename,
  onDuplicate,
  onDelete,
  onOpenChange,
}: PatternActionsMenuProps) => {
  const translate = useTranslate();

  const actions: IAction[] = [
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

  const handleOnAction = (action: string) => {
    switch (action) {
      case "rename":
        return onRename();
      case "duplicate":
        return onDuplicate();
      case "delete":
        return onDelete();
    }
  };

  return (
    <ItemActions
      actions={actions}
      onAction={handleOnAction}
      isSelected={isSelected}
      onOpenChange={onOpenChange}
    />
  );
};

type CategorizeActionsMenuProps = {
  isSelected: boolean;
  onCategorize: (type: SectionType) => void;
  onDelete: () => void;
  onOpenChange: (open: boolean) => void;
};

const CategorizeActionsMenu = ({
  isSelected,
  onCategorize,
  onDelete,
  onOpenChange,
}: CategorizeActionsMenuProps) => {
  const translate = useTranslate();

  const actions: IAction[] = [
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

  const handleOnAction = (action: string) => {
    switch (action) {
      case "setAsDemand":
        return onCategorize("demand");
      case "setAsReservoirHead":
        return onCategorize("reservoirHead");
      case "setAsPumpSpeed":
        return onCategorize("pumpSpeed");
      case "delete":
        return onDelete();
    }
  };

  return (
    <ItemActions
      actions={actions}
      onAction={handleOnAction}
      isSelected={isSelected}
      onOpenChange={onOpenChange}
    />
  );
};
