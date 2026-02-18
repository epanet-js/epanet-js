import { useState } from "react";
import * as DD from "@radix-ui/react-dropdown-menu";
import { useTranslate } from "src/hooks/use-translate";
import { Pattern, PatternId, PatternType } from "src/hydraulic-model";
import {
  CloseIcon,
  DuplicateIcon,
  MoreActionsIcon,
  RenameIcon,
} from "src/icons";
import { Button, DDContent, StyledItem } from "src/components/elements";
import { EditableTextFieldWithConfirmation } from "src/components/form/editable-text-field-with-confirmation";

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

  const isRenaming =
    actionState?.action === "renaming" && actionState.patternId === pattern.id;
  const isCloning =
    actionState?.action === "cloning" &&
    actionState.sourcePattern.id === pattern.id;

  if (isRenaming) {
    return (
      <PatternLabelInput
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
        className={`group flex items-center justify-between text-sm cursor-pointer h-8 ${
          isSelected
            ? "bg-gray-200 dark:hover:bg-gray-700"
            : "hover:bg-gray-100 dark:hover:bg-gray-800"
        }`}
      >
        <Button
          variant="quiet/list"
          size="sm"
          onClick={onSelect}
          className="flex-1 justify-start truncate hover:bg-transparent dark:hover:bg-transparent focus-visible:!ring-0 focus-visible:!ring-offset-0"
        >
          {pattern.label}
        </Button>
        {!readOnly && (
          <PatternActionsMenu
            isSelected={isSelected}
            onOpen={onSelect}
            onRename={() => onStartRename(pattern.id)}
            onDuplicate={() => onStartClone(pattern)}
            onDelete={onDelete}
          />
        )}
      </li>
      {isCloning && (
        <PatternLabelInput
          label="Clone pattern name"
          value={pattern.label}
          placeholder={translate("patternName")}
          onCommit={onPatternLabelChange}
          onCancel={onCancel}
          forceValidation
        />
      )}
    </>
  );
};

type PatternLabelInputProps = {
  label: string;
  value: string;
  placeholder?: string;
  onCommit: (name: string) => boolean;
  onCancel: () => void;
  forceValidation?: boolean;
};

export const PatternLabelInput = ({
  label,
  value,
  placeholder,
  onCommit,
  onCancel,
  forceValidation,
}: PatternLabelInputProps) => {
  const [hasError, setHasError] = useState(false);

  const handleChangeValue = (newValue: string): boolean => {
    const hasValidationError = onCommit(newValue);
    setHasError(hasValidationError);
    return hasValidationError;
  };

  return (
    <li
      className="flex items-center text-sm bg-white dark:bg-gray-700 px-1 h-8"
      data-capture-escape-key
    >
      <EditableTextFieldWithConfirmation
        label={label}
        value={value}
        onChangeValue={handleChangeValue}
        onReset={onCancel}
        hasError={hasError}
        allowedChars={/(?![\s;])[\x00-\xFF]/}
        maxByteLength={31}
        styleOptions={{
          padding: "sm",
          textSize: "sm",
        }}
        placeholder={placeholder}
        autoFocus
        forceValidation={forceValidation}
      />
    </li>
  );
};

type PatternActionsMenuProps = {
  isSelected: boolean;
  onOpen: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

const PatternActionsMenu = ({
  isSelected,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}: PatternActionsMenuProps) => {
  const translate = useTranslate();

  const handleOpenChange = (open: boolean) => {
    if (open) onOpen();
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
                : "invisible group-hover:visible hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            <MoreActionsIcon size="sm" />
          </Button>
        </DD.Trigger>
        <DD.Portal>
          <DDContent align="start" side="bottom" className="z-50">
            <StyledItem onSelect={onRename}>
              <RenameIcon size="sm" />
              {translate("rename")}
            </StyledItem>
            <StyledItem onSelect={onDuplicate}>
              <DuplicateIcon size="sm" />
              {translate("duplicate")}
            </StyledItem>
            <StyledItem variant="destructive" onSelect={onDelete}>
              <CloseIcon size="sm" />
              {translate("delete")}
            </StyledItem>
          </DDContent>
        </DD.Portal>
      </DD.Root>
    </div>
  );
};
