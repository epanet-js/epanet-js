import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import * as C from "@radix-ui/react-collapsible";
import { useTranslate } from "src/hooks/use-translate";
import {
  PatternMultipliers,
  Patterns,
  PatternId,
  PatternType,
} from "src/hydraulic-model";
import { AddIcon, ChevronDownIcon, ChevronRightIcon } from "src/icons";
import { Button } from "src/components/elements";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { useUserTracking } from "src/infra/user-tracking";
import {
  ActionState,
  PatternSidebarItem,
  PatternLabelInput,
  SectionType,
  TypedPattern,
} from "./pattern-sidebar-shared";

type NavItem =
  | { kind: "section"; sectionType: SectionType }
  | { kind: "pattern"; patternId: PatternId };

const SECTION_TYPES: SectionType[] = ["demand", "reservoirHead", "pumpSpeed"];

const SECTION_TRANSLATION_KEYS: Record<SectionType, string> = {
  demand: "demandPatterns",
  reservoirHead: "reservoirHeadPatterns",
  pumpSpeed: "pumpSpeedPatterns",
};

type GroupedPatternSidebarProps = {
  patterns: Patterns;
  selectedPatternId: PatternId | null;
  minPatternSteps: number;
  onSelectPattern: (patternId: PatternId | null) => void;
  onAddPattern: (
    label: string,
    multipliers: PatternMultipliers,
    source: "new" | "clone",
    type: PatternType,
  ) => PatternId;
  onChangePattern: (patternId: PatternId, updates: { label: string }) => void;
  onDeletePattern: (patternId: PatternId) => void;
  readOnly?: boolean;
};

export const GroupedPatternSidebar = ({
  patterns,
  selectedPatternId,
  minPatternSteps,
  onSelectPattern,
  onAddPattern,
  onChangePattern,
  onDeletePattern,
  readOnly = false,
}: GroupedPatternSidebarProps) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const labelManager = useRef(new LabelManager());
  const listRef = useRef<HTMLDivElement>(null);
  const [actionState, setActionState] = useState<ActionState | undefined>(
    undefined,
  );
  const [focusedSection, setFocusedSection] = useState<SectionType | null>(
    null,
  );
  const [openSections, setOpenSections] = useState<
    Record<SectionType, boolean>
  >({
    demand: true,
    reservoirHead: true,
    pumpSpeed: true,
  });

  const clearActionState = () => {
    setActionState(undefined);
    requestAnimationFrame(() => listRef.current?.focus());
  };

  useEffect(() => {
    labelManager.current = new LabelManager();
    for (const pattern of patterns.values()) {
      labelManager.current.register(pattern.label, "pattern", pattern.id);
    }
  }, [patterns]);

  const groupedPatterns = useMemo(() => {
    const groups: Record<SectionType, TypedPattern[]> = {
      demand: [],
      reservoirHead: [],
      pumpSpeed: [],
    };
    for (const pattern of patterns.values()) {
      const type = pattern.type as SectionType | undefined;
      if (type && type in groups) {
        groups[type].push(pattern as TypedPattern);
      } else {
        groups.demand.push({ ...pattern, type: "demand" });
      }
    }
    return groups;
  }, [patterns]);

  const navItems = useMemo(() => {
    const items: NavItem[] = [];
    for (const sectionType of SECTION_TYPES) {
      items.push({ kind: "section", sectionType });
      if (openSections[sectionType]) {
        for (const p of groupedPatterns[sectionType]) {
          items.push({ kind: "pattern", patternId: p.id });
        }
      }
    }
    return items;
  }, [openSections, groupedPatterns]);

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

  const toggleSection = useCallback((sectionType: SectionType) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionType]: !prev[sectionType],
    }));
  }, []);

  const currentNavIndex = useMemo(() => {
    if (focusedSection) {
      return navItems.findIndex(
        (item) =>
          item.kind === "section" && item.sectionType === focusedSection,
      );
    }
    if (selectedPatternId) {
      return navItems.findIndex(
        (item) =>
          item.kind === "pattern" && item.patternId === selectedPatternId,
      );
    }
    return -1;
  }, [focusedSection, selectedPatternId, navItems]);

  const navigateToItem = useCallback(
    (item: NavItem) => {
      if (item.kind === "section") {
        setFocusedSection(item.sectionType);
        onSelectPattern(null);
        const el = listRef.current?.querySelector(
          `[data-section-type="${item.sectionType}"]`,
        );
        el?.scrollIntoView({ block: "nearest" });
      } else {
        setFocusedSection(null);
        onSelectPattern(item.patternId);
        const el = listRef.current?.querySelector(
          `[data-pattern-id="${item.patternId}"]`,
        );
        el?.scrollIntoView({ block: "nearest" });
      }
    },
    [onSelectPattern],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (actionState) return;

      if (e.key === "Enter" && focusedSection) {
        e.preventDefault();
        e.stopPropagation();
        toggleSection(focusedSection);
        return;
      }

      if (e.key === "Escape" && selectedPatternId) {
        e.preventDefault();
        e.stopPropagation();
        const pattern = patterns.get(selectedPatternId) as TypedPattern;
        const sectionType = pattern.type as SectionType;
        navigateToItem({ kind: "section", sectionType });
        return;
      }

      const validKeys = [
        "ArrowUp",
        "ArrowDown",
        "PageUp",
        "PageDown",
        "Home",
        "End",
      ];
      if (!validKeys.includes(e.key)) return;
      if (navItems.length === 0) return;

      e.preventDefault();
      e.stopPropagation();

      const itemHeight = 32; // h-8
      const containerHeight = listRef.current?.clientHeight ?? itemHeight;
      const pageSize = Math.max(1, Math.floor(containerHeight / itemHeight));

      let nextIndex: number;
      switch (e.key) {
        case "ArrowDown":
          nextIndex =
            currentNavIndex < navItems.length - 1 ? currentNavIndex + 1 : 0;
          break;
        case "ArrowUp":
          nextIndex =
            currentNavIndex > 0 ? currentNavIndex - 1 : navItems.length - 1;
          break;
        case "PageDown":
          nextIndex = Math.min(currentNavIndex + pageSize, navItems.length - 1);
          break;
        case "PageUp":
          nextIndex = Math.max(currentNavIndex - pageSize, 0);
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = navItems.length - 1;
          break;
        default:
          return;
      }

      navigateToItem(navItems[nextIndex]);
    },
    [
      actionState,
      focusedSection,
      selectedPatternId,
      patterns,
      navItems,
      currentNavIndex,
      toggleSection,
      navigateToItem,
    ],
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
      const type = isCloning
        ? actionState.sourcePattern.type
        : actionState.patternType;
      const newId = onAddPattern(trimmedName, multipliers, source, type);
      onSelectPattern(newId);
    }

    clearActionState();
    return false;
  };

  const creatingInSection =
    actionState?.action === "creating" ? actionState.patternType : undefined;

  return (
    <div className="w-56 flex-shrink-0 flex flex-col gap-2">
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto outline-none placemark-scrollbar scroll-shadows border border-gray-200 dark:border-gray-700 rounded"
        onKeyDown={handleKeyDown}
        tabIndex={0}
        {...(selectedPatternId != null && {
          "data-capture-escape-key": true,
        })}
      >
        {SECTION_TYPES.map((sectionType) => (
          <PatternSection
            key={sectionType}
            sectionType={sectionType}
            title={translate(SECTION_TRANSLATION_KEYS[sectionType])}
            isOpen={openSections[sectionType]}
            isFocused={focusedSection === sectionType}
            onToggle={() => toggleSection(sectionType)}
            patterns={groupedPatterns[sectionType]}
            selectedPatternId={selectedPatternId}
            actionState={actionState}
            isCreating={creatingInSection === sectionType}
            onSelectPattern={(patternId) => {
              setFocusedSection(null);
              onSelectPattern(patternId);
            }}
            onStartCreate={() =>
              setActionState({ action: "creating", patternType: sectionType })
            }
            onStartRename={(patternId) =>
              setActionState({ action: "renaming", patternId })
            }
            onStartClone={(sourcePattern) =>
              setActionState({
                action: "cloning",
                sourcePattern: sourcePattern,
              })
            }
            onDelete={onDeletePattern}
            onPatternLabelChange={handlePatternLabelChange}
            onCancelAction={clearActionState}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  );
};

type PatternSectionProps = {
  sectionType: SectionType;
  title: string;
  isOpen: boolean;
  isFocused: boolean;
  onToggle: () => void;
  patterns: TypedPattern[];
  selectedPatternId: PatternId | null;
  actionState: ActionState | undefined;
  isCreating: boolean;
  onSelectPattern: (patternId: PatternId) => void;
  onStartCreate: () => void;
  onStartRename: (patternId: PatternId) => void;
  onStartClone: (pattern: TypedPattern) => void;
  onDelete: (patternId: PatternId) => void;
  onPatternLabelChange: (name: string) => boolean;
  onCancelAction: () => void;
  readOnly: boolean;
};

const PatternSection = ({
  sectionType,
  title,
  isOpen,
  isFocused,
  onToggle,
  patterns,
  selectedPatternId,
  actionState,
  isCreating,
  onSelectPattern,
  onStartCreate,
  onStartRename,
  onStartClone,
  onDelete,
  onPatternLabelChange,
  onCancelAction,
  readOnly,
}: PatternSectionProps) => {
  const translate = useTranslate();

  return (
    <C.Root open={isOpen} onOpenChange={onToggle}>
      <div
        data-section-type={sectionType}
        className={`group/section flex items-center justify-between h-8 px-1 ${
          isFocused
            ? "bg-gray-200 dark:bg-gray-700"
            : "hover:bg-gray-100 dark:hover:bg-gray-800"
        }`}
      >
        <C.Trigger asChild>
          <button className="flex-1 min-w-0 flex items-center gap-1 text-sm font-medium text-gray-500 dark:text-gray-400">
            {isOpen ? (
              <ChevronDownIcon size="sm" />
            ) : (
              <ChevronRightIcon size="sm" />
            )}
            <span className="truncate">{title}</span>
            <span className="shrink-0">({patterns.length})</span>
          </button>
        </C.Trigger>
        {!readOnly && (
          <Button
            variant="quiet"
            size="xs"
            aria-label={`Add ${title}`}
            onClick={onStartCreate}
            className="h-6 w-6 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <AddIcon />
          </Button>
        )}
      </div>
      <C.Content>
        <ul className="pl-4">
          {patterns.map((pattern) => (
            <PatternSidebarItem
              key={pattern.id}
              pattern={pattern}
              isSelected={pattern.id === selectedPatternId}
              onSelect={() => onSelectPattern(pattern.id)}
              actionState={actionState}
              onCancel={onCancelAction}
              onStartRename={onStartRename}
              onStartClone={onStartClone}
              onDelete={() => onDelete(pattern.id)}
              onPatternLabelChange={onPatternLabelChange}
              readOnly={readOnly}
            />
          ))}
          {isCreating && (
            <PatternLabelInput
              label="New pattern name"
              value=""
              placeholder={translate("patternName")}
              onCommit={onPatternLabelChange}
              onCancel={onCancelAction}
            />
          )}
        </ul>
      </C.Content>
    </C.Root>
  );
};
