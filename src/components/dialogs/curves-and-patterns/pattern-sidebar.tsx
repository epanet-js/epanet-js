import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import * as DD from "@radix-ui/react-dropdown-menu";
import { useTranslate } from "src/hooks/use-translate";
import {
  PatternMultipliers,
  DemandPatterns,
  DemandPattern,
  PatternId,
} from "src/hydraulic-model/demands";
import {
  AddIcon,
  CloseIcon,
  DuplicateIcon,
  MoreActionsIcon,
  RenameIcon,
} from "src/icons";
import { Button, DDContent, StyledItem } from "src/components/elements";
import { EditableTextFieldWithConfirmation } from "src/components/form/editable-text-field-with-confirmation";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { useUserTracking } from "src/infra/user-tracking";

type ActionState =
  | { action: "creating" }
  | { action: "renaming"; patternId: PatternId }
  | { action: "cloning"; sourcePattern: DemandPattern };

type PatternSidebarProps = {
  patterns: DemandPatterns;
  selectedPatternId: PatternId | null;
  minPatternSteps: number;
  onSelectPattern: (patternId: PatternId) => void;
  onAddPattern: (
    label: string,
    multipliers: PatternMultipliers,
    source: "new" | "clone",
  ) => PatternId;
  onChangePattern: (patternId: PatternId, updates: { label: string }) => void;
  onDeletePattern: (patternId: PatternId) => void;
};

export const PatternSidebar = ({
  patterns,
  selectedPatternId,
  minPatternSteps,
  onSelectPattern,
  onAddPattern,
  onChangePattern,
  onDeletePattern,
}: PatternSidebarProps) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const labelManager = useRef(new LabelManager());
  const listRef = useRef<HTMLUListElement>(null);
  const [actionState, setActionState] = useState<ActionState | undefined>(
    undefined,
  );

  const clearActionState = () => setActionState(undefined);

  useEffect(() => {
    labelManager.current = new LabelManager();
    for (const pattern of patterns.values()) {
      labelManager.current.register(pattern.label, "pattern", pattern.id);
    }
  }, [patterns]);

  const isCreating = actionState?.action === "creating";
  const patternIds = useMemo(() => Array.from(patterns.keys()), [patterns]);

  useEffect(
    function autoScrollToSelectedItem() {
      if (!selectedPatternId) return;
      const item = listRef.current?.querySelector(
        `[data-pattern-id="${selectedPatternId}"]`,
      );
      item?.scrollIntoView({ block: "nearest" });
    },
    [selectedPatternId, patterns],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLUListElement>) => {
      const validKeys = [
        "ArrowUp",
        "ArrowDown",
        "PageUp",
        "PageDown",
        "Home",
        "End",
      ];
      if (!validKeys.includes(e.key)) return;
      if (patternIds.length === 0) return;

      e.preventDefault();
      e.stopPropagation();

      if (actionState) return;

      const selectedIndex = selectedPatternId
        ? patternIds.indexOf(selectedPatternId)
        : -1;

      const itemHeight = 32; // h-8
      const containerHeight = listRef.current?.clientHeight ?? itemHeight;
      const pageSize = Math.max(1, Math.floor(containerHeight / itemHeight));

      let nextIndex: number;
      switch (e.key) {
        case "ArrowDown":
          nextIndex =
            selectedIndex < patternIds.length - 1 ? selectedIndex + 1 : 0;
          break;
        case "ArrowUp":
          nextIndex =
            selectedIndex > 0 ? selectedIndex - 1 : patternIds.length - 1;
          break;
        case "PageDown":
          nextIndex = Math.min(selectedIndex + pageSize, patternIds.length - 1);
          break;
        case "PageUp":
          nextIndex = Math.max(selectedIndex - pageSize, 0);
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = patternIds.length - 1;
          break;
        default:
          return;
      }

      const nextPatternId = patternIds[nextIndex];
      onSelectPattern(nextPatternId);

      const item = listRef.current?.querySelector(
        `[data-pattern-id="${nextPatternId}"]`,
      );
      item?.scrollIntoView({ block: "nearest" });
    },
    [actionState, patternIds, selectedPatternId, onSelectPattern],
  );

  const handlePatternLabelChange = (name: string): boolean => {
    if (!actionState) return true;

    const trimmedName = name.trim();
    if (!trimmedName) return true;

    const excludeId =
      actionState.action === "renaming" ? actionState.patternId : undefined;
    if (
      !labelManager.current.isLabelAvailable(trimmedName, "pattern", excludeId)
    ) {
      userTracking.capture({ name: "pattern.labelDuplicate" });
      return true;
    }

    if (actionState.action === "renaming") {
      onChangePattern(actionState.patternId, { label: trimmedName });
    } else {
      const isCloning = actionState.action === "cloning";
      const multipliers = isCloning
        ? [...actionState.sourcePattern.multipliers]
        : Array(minPatternSteps).fill(1);
      const source = isCloning ? "clone" : "new";
      const newId = onAddPattern(trimmedName, multipliers, source);
      onSelectPattern(newId);
    }

    clearActionState();
    return false;
  };

  return (
    <div className="w-56 flex-shrink-0 flex flex-col gap-2">
      <ul
        ref={listRef}
        className="flex-1 overflow-y-auto gap-2 outline-none placemark-scrollbar scroll-shadows border border-gray-200 dark:border-gray-700 rounded"
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {[...patterns.values()].map((pattern) => (
          <PatternSidebarItem
            key={pattern.id}
            pattern={pattern}
            isSelected={pattern.id === selectedPatternId}
            onSelect={() => onSelectPattern(pattern.id)}
            actionState={actionState}
            onCancel={clearActionState}
            onStartRename={() =>
              setActionState({ action: "renaming", patternId: pattern.id })
            }
            onStartClone={() =>
              setActionState({
                action: "cloning",
                sourcePattern: pattern,
              })
            }
            onDelete={() => onDeletePattern(pattern.id)}
            onPatternLabelChange={handlePatternLabelChange}
          />
        ))}
        {isCreating && (
          <PatternLabelInput
            label="New pattern name"
            value=""
            placeholder={translate("patternName")}
            onCommit={handlePatternLabelChange}
            onCancel={clearActionState}
          />
        )}
      </ul>
      <Button
        variant="default"
        size="sm"
        className="w-full justify-center"
        onClick={() => setActionState({ action: "creating" })}
      >
        <AddIcon size="sm" />
        {translate("addPattern")}
      </Button>
    </div>
  );
};

type PatternSidebarItemProps = {
  pattern: DemandPattern;
  isSelected: boolean;
  onSelect: () => void;
  actionState: ActionState | undefined;
  onCancel: () => void;
  onStartRename: (patternId: PatternId) => void;
  onStartClone: (pattern: DemandPattern) => void;
  onDelete: () => void;
  onPatternLabelChange: (name: string) => boolean;
};

const PatternSidebarItem = ({
  pattern,
  isSelected,
  onSelect,
  actionState,
  onCancel,
  onStartRename,
  onStartClone,
  onDelete,
  onPatternLabelChange,
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
        <PatternActionsMenu
          isSelected={isSelected}
          onRename={() => {
            onSelect();
            onStartRename(pattern.id);
          }}
          onDuplicate={() => {
            onSelect();
            onStartClone(pattern);
          }}
          onDelete={onDelete}
        />
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

const PatternLabelInput = ({
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
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

const PatternActionsMenu = ({
  isSelected,
  onRename,
  onDuplicate,
  onDelete,
}: PatternActionsMenuProps) => {
  const translate = useTranslate();

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="self-stretch flex pr-1"
    >
      <DD.Root modal={false}>
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
