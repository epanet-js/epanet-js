import { useState, useRef, useEffect } from "react";
import * as DD from "@radix-ui/react-dropdown-menu";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { DemandPattern, PatternId } from "src/hydraulic-model/demands";
import {
  AddIcon,
  CloseIcon,
  DuplicateIcon,
  MoreActionsIcon,
  RenameIcon,
} from "src/icons";
import { Button, DDContent, StyledItem } from "src/components/elements";
import { EditableTextFieldWithConfirmation } from "src/components/form/editable-text-field-with-confirmation";

type PatternSidebarProps = {
  patterns: Map<PatternId, DemandPattern>;
  selectedPatternId: PatternId | null;
  onSelectPattern: (patternId: PatternId) => void;
  onAddPattern: (patternId: PatternId, pattern: DemandPattern) => void;
};

export const PatternSidebar = ({
  patterns,
  selectedPatternId,
  onSelectPattern,
  onAddPattern,
}: PatternSidebarProps) => {
  const translate = useTranslate();
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  const patternIds = Array.from(patterns.keys());

  useEffect(() => {
    if (isCreatingNew && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [isCreatingNew]);

  const handleStartCreating = () => {
    setIsCreatingNew(true);
  };

  const handleCommitNewPattern = (name: string): boolean => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return true; // validation error
    }
    const normalizedName = trimmedName.toUpperCase();
    if (patterns.has(normalizedName)) {
      return true; // duplicate name error
    }

    onAddPattern(normalizedName, [1]);
    setIsCreatingNew(false);
    onSelectPattern(normalizedName);
    return false; // no error
  };

  const handleCancelNewPattern = () => {
    setIsCreatingNew(false);
  };

  return (
    <div className="w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col p-2 gap-2">
      {(patternIds.length > 0 || isCreatingNew) && (
        <ul ref={listRef} className="flex-1 overflow-y-auto gap-2">
          {patternIds.map((patternId) => (
            <PatternSidebarItem
              key={patternId}
              patternId={patternId}
              isSelected={patternId === selectedPatternId}
              onSelect={() => onSelectPattern(patternId)}
            />
          ))}
          {isCreatingNew && (
            <NewPatternItem
              onCommit={handleCommitNewPattern}
              onCancel={handleCancelNewPattern}
            />
          )}
        </ul>
      )}
      <Button
        variant="default"
        size="sm"
        className="w-full justify-center"
        onClick={handleStartCreating}
      >
        <AddIcon size="sm" />
        {translate("addPattern")}
      </Button>
    </div>
  );
};

type PatternSidebarItemProps = {
  patternId: PatternId;
  isSelected: boolean;
  onSelect: () => void;
};

const PatternSidebarItem = ({
  patternId,
  isSelected,
  onSelect,
}: PatternSidebarItemProps) => {
  const showAdvancedFeatures = useFeatureFlag("FLAG_DEMAND_PATTERNS_ADVANCED");

  return (
    <li
      className={`group flex items-center justify-between text-sm cursor-pointer ${
        isSelected
          ? "bg-gray-200 dark:hover:bg-gray-700"
          : "hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
    >
      <Button
        variant="quiet"
        size="sm"
        onClick={onSelect}
        className="flex-1 justify-start truncate hover:bg-transparent dark:hover:bg-transparent"
      >
        {patternId}
      </Button>
      {showAdvancedFeatures && <PatternActionsMenu isSelected={isSelected} />}
    </li>
  );
};

type NewPatternItemProps = {
  onCommit: (name: string) => boolean;
  onCancel: () => void;
};

const NewPatternItem = ({ onCommit, onCancel }: NewPatternItemProps) => {
  const [hasError, setHasError] = useState(false);
  const translate = useTranslate();

  const handleChangeValue = (value: string): boolean => {
    const hasValidationError = onCommit(value);
    setHasError(hasValidationError);
    return hasValidationError;
  };

  return (
    <li className="flex items-center text-sm bg-white dark:bg-gray-700 pl-2">
      <EditableTextFieldWithConfirmation
        label="New pattern name"
        value=""
        onChangeValue={handleChangeValue}
        onReset={onCancel}
        hasError={hasError}
        allowedChars={/(?![\s;])[\x00-\xFF]/}
        maxByteLength={31}
        styleOptions={{
          padding: "sm",
          textSize: "sm",
        }}
        placeholder={translate("patternName")}
      />
    </li>
  );
};

type PatternActionsMenuProps = {
  isSelected: boolean;
};

const PatternActionsMenu = ({ isSelected }: PatternActionsMenuProps) => {
  const translate = useTranslate();

  return (
    <div onClick={(e) => e.stopPropagation()} className="self-stretch flex">
      <DD.Root modal={false}>
        <DD.Trigger asChild>
          <Button
            variant="quiet"
            size="xs"
            className={`h-full ${
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
            <StyledItem onSelect={() => {}}>
              <RenameIcon size="sm" />
              {translate("rename")}
            </StyledItem>
            <StyledItem onSelect={() => {}}>
              <DuplicateIcon size="sm" />
              {translate("duplicate")}
            </StyledItem>
            <StyledItem variant="destructive" onSelect={() => {}}>
              <CloseIcon size="sm" />
              {translate("delete")}
            </StyledItem>
          </DDContent>
        </DD.Portal>
      </DD.Root>
    </div>
  );
};
