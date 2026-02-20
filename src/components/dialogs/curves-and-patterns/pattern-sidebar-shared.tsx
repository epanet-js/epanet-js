import { useState } from "react";
import * as DD from "@radix-ui/react-dropdown-menu";
import { useTranslate } from "src/hooks/use-translate";
import { Pattern, PatternId, PatternType } from "src/hydraulic-model";
import {
  ChevronRightIcon,
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
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
            className={`h-6 w-6 self-center ${
              isSelected
                ? "hover:bg-white/30 dark:hover:bg-white/10"
                : isOpen
                  ? "hover:bg-gray-200 dark:hover:bg-gray-700"
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
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
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
            className={`h-6 w-6 self-center ${
              isSelected
                ? "hover:bg-white/30 dark:hover:bg-white/10"
                : isOpen
                  ? "hover:bg-gray-200 dark:hover:bg-gray-700"
                  : "invisible group-hover:visible hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            <MoreActionsIcon size="sm" />
          </Button>
        </DD.Trigger>
        <DD.Portal>
          <DDContent align="start" side="bottom" className="z-50">
            <StyledItem onSelect={() => onCategorize("demand")}>
              <ChevronRightIcon size="sm" />
              {translate("setAsDemand")}
            </StyledItem>
            <StyledItem onSelect={() => onCategorize("reservoirHead")}>
              <ChevronRightIcon size="sm" />
              {translate("setAsReservoirHead")}
            </StyledItem>
            <StyledItem onSelect={() => onCategorize("pumpSpeed")}>
              <ChevronRightIcon size="sm" />
              {translate("setAsPumpSpeed")}
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
