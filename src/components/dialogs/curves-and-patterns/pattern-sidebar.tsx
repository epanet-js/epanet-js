import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useTranslate } from "src/hooks/use-translate";
import {
  PatternMultipliers,
  Patterns,
  PatternId,
  PatternType,
} from "src/hydraulic-model";
import { AddIcon } from "src/icons";
import { Button } from "src/components/elements";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { useUserTracking } from "src/infra/user-tracking";
import {
  ActionState,
  PatternSidebarItem,
  PatternLabelInput,
  TypedPattern,
} from "./pattern-sidebar-shared";

type PatternSidebarProps = {
  patterns: Patterns;
  selectedPatternId: PatternId | null;
  minPatternSteps: number;
  onSelectPattern: (patternId: PatternId) => void;
  onAddPattern: (
    label: string,
    multipliers: PatternMultipliers,
    source: "new" | "clone",
    type?: PatternType,
  ) => PatternId;
  onChangePattern: (patternId: PatternId, updates: { label: string }) => void;
  onDeletePattern: (patternId: PatternId, patternType: PatternType) => void;
  readOnly?: boolean;
};

export const PatternSidebar = ({
  patterns,
  selectedPatternId,
  minPatternSteps,
  onSelectPattern,
  onAddPattern,
  onChangePattern,
  onDeletePattern,
  readOnly = false,
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
            pattern={pattern as TypedPattern}
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
                sourcePattern: pattern as TypedPattern,
              })
            }
            onDelete={() => onDeletePattern(pattern.id, "demand")}
            onPatternLabelChange={handlePatternLabelChange}
            readOnly={readOnly}
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
      {!readOnly && (
        <Button
          variant="default"
          size="sm"
          className="w-full justify-center"
          onClick={() =>
            setActionState({ action: "creating", patternType: "demand" })
          }
        >
          <AddIcon size="sm" />
          {translate("addPattern")}
        </Button>
      )}
    </div>
  );
};
