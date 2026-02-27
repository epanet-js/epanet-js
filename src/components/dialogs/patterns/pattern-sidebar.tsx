import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useTranslate } from "src/hooks/use-translate";
import {
  Pattern,
  PatternMultipliers,
  Patterns,
  PatternId,
  PatternType,
} from "src/hydraulic-model";
import {
  AddIcon,
  ChevronRightIcon,
  CloseIcon,
  DuplicateIcon,
  RenameIcon,
} from "src/icons";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { useUserTracking } from "src/infra/user-tracking";
import {
  CollapsibleListSection,
  EditableListItem,
  ItemAction,
  ItemInput,
  ListItem,
  NavigableList,
} from "src/components/list";
import type { NavItem, NavigableListHandle } from "src/components/list";

type SectionType = Extract<
  PatternType,
  "demand" | "reservoirHead" | "pumpSpeed"
>;

type TypedPattern = Pattern & { type: SectionType };

type ActionState =
  | { action: "creating"; patternType: PatternType }
  | { action: "renaming"; patternId: PatternId }
  | { action: "cloning"; sourcePattern: TypedPattern };

type SidebarSectionType = SectionType | "uncategorized";

const SECTION_TYPES: SectionType[] = ["demand", "reservoirHead", "pumpSpeed"];

const SECTION_TRANSLATION_KEYS: Record<SectionType, string> = {
  demand: "patterns.demandPatterns",
  reservoirHead: "patterns.reservoirHeadPatterns",
  pumpSpeed: "patterns.pumpSpeedPatterns",
};

type PatternSidebarProps = {
  width: number;
  patterns: Patterns;
  selectedPatternId: PatternId | null;
  initialSection?: SectionType;
  minPatternSteps: number;
  onSelectPattern: (patternId: PatternId | null) => void;
  onAddPattern: (
    label: string,
    multipliers: PatternMultipliers,
    source: "new" | "clone",
    type: PatternType,
  ) => PatternId;
  onChangePattern: (
    patternId: PatternId,
    updates: { label?: string; type?: PatternType },
  ) => void;
  onDeletePattern: (patternId: PatternId, patternType?: PatternType) => void;
  readOnly?: boolean;
};

export const PatternSidebar = ({
  width,
  patterns,
  selectedPatternId,
  initialSection,
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
  const listRef = useRef<NavigableListHandle>(null);
  const [actionState, setActionState] = useState<ActionState | undefined>(
    undefined,
  );
  const [focusedSection, setFocusedSection] =
    useState<SidebarSectionType | null>(
      initialSection && !selectedPatternId ? initialSection : null,
    );

  const clearActionState = () => {
    setActionState(undefined);
    requestAnimationFrame(() => listRef.current?.focus());
  };

  useEffect(
    function initializeLocalLabelManager() {
      labelManager.current = new LabelManager();
      for (const pattern of patterns.values()) {
        labelManager.current.register(pattern.label, "pattern", pattern.id);
      }
    },
    [patterns],
  );

  const { groupedPatterns, navItems } = useMemo(() => {
    const groups: Record<SectionType, TypedPattern[]> = {
      demand: [],
      reservoirHead: [],
      pumpSpeed: [],
    };
    const uncategorized: Pattern[] = [];
    const items: NavItem<SidebarSectionType>[] = [];
    for (const pattern of patterns.values()) {
      const type = pattern.type as SectionType | undefined;
      if (type && type in groups) {
        groups[type].push(pattern as TypedPattern);
        items.push({ id: pattern.id, section: type });
      } else {
        uncategorized.push(pattern);
        items.push({ id: pattern.id, section: "uncategorized" });
      }
    }
    return {
      groupedPatterns: { ...groups, uncategorized },
      navItems: items,
    };
  }, [patterns]);

  useEffect(
    function autoScrollToSelectedItem() {
      if (!selectedPatternId) return;
      const item = listRef.current?.querySelector(
        `[data-item-id="${selectedPatternId}"]`,
      );
      item?.scrollIntoView({ block: "nearest" });
    },
    [selectedPatternId, patterns],
  );

  const focusedItem = useMemo((): NavItem<SidebarSectionType> | undefined => {
    if (focusedSection) {
      return { section: focusedSection };
    }
    if (selectedPatternId !== null) {
      for (const sectionType of SECTION_TYPES) {
        if (
          groupedPatterns[sectionType].some((p) => p.id === selectedPatternId)
        ) {
          return { id: selectedPatternId, section: sectionType };
        }
      }
      return { id: selectedPatternId, section: "uncategorized" };
    }
    return undefined;
  }, [focusedSection, selectedPatternId, groupedPatterns]);

  const handleSelectItem = useCallback(
    (item: NavItem<SidebarSectionType>) => {
      if (item.id != null) {
        setFocusedSection(null);
        onSelectPattern(item.id);
      } else {
        setFocusedSection(item.section);
        onSelectPattern(null);
      }
    },
    [onSelectPattern],
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
    } else if (actionState.action === "cloning") {
      const multipliers = [...actionState.sourcePattern.multipliers];
      const newId = onAddPattern(
        trimmedName,
        multipliers,
        "clone",
        actionState.sourcePattern.type,
      );
      onSelectPattern(newId);
    } else if (actionState.action === "creating") {
      const multipliers = Array(minPatternSteps).fill(1) as number[];
      const newId = onAddPattern(
        trimmedName,
        multipliers,
        "new",
        actionState.patternType,
      );
      onSelectPattern(newId);
    }

    clearActionState();
    return false;
  };

  const creatingInSection =
    actionState?.action === "creating" ? actionState.patternType : undefined;

  const handleCategorize = useCallback(
    (patternId: PatternId, type: SectionType) => {
      onChangePattern(patternId, { type });
      userTracking.capture({ name: "pattern.changed", property: "type" });
    },
    [onChangePattern, userTracking],
  );

  return (
    <div className="flex-shrink-0 flex flex-col gap-2" style={{ width }}>
      <NavigableList
        ref={listRef}
        navItems={navItems}
        focusedItem={focusedItem}
        onSelectItem={handleSelectItem}
        isNavBlocked={!!actionState}
      >
        {SECTION_TYPES.map((sectionType) => (
          <PatternSection
            key={sectionType}
            sectionType={sectionType}
            title={translate(SECTION_TRANSLATION_KEYS[sectionType])}
            isFocused={focusedSection === sectionType}
            patterns={groupedPatterns[sectionType]}
            selectedPatternId={selectedPatternId}
            actionState={actionState}
            isCreating={creatingInSection === sectionType}
            onSelectPattern={(patternId) => {
              setFocusedSection(null);
              onSelectPattern(patternId);
            }}
            onStartCreate={() => {
              setActionState({ action: "creating", patternType: sectionType });
              listRef.current?.openSection(sectionType);
            }}
            onStartRename={(patternId) =>
              setActionState({ action: "renaming", patternId })
            }
            onStartClone={(sourcePattern) =>
              setActionState({
                action: "cloning",
                sourcePattern: sourcePattern,
              })
            }
            onDelete={(patternId, patternType) => {
              onSelectPattern(null);
              onDeletePattern(patternId, patternType);
            }}
            onPatternLabelChange={handlePatternLabelChange}
            onCancelAction={clearActionState}
            readOnly={readOnly}
          />
        ))}
        {groupedPatterns.uncategorized.length > 0 && (
          <UncategorizedPatternSection
            isFocused={focusedSection === "uncategorized"}
            patterns={groupedPatterns.uncategorized}
            selectedPatternId={selectedPatternId}
            onSelectPattern={(patternId) => {
              setFocusedSection(null);
              onSelectPattern(patternId);
            }}
            onCategorize={handleCategorize}
            onDelete={(patternId) => {
              clearActionState();
              onSelectPattern(null);
              onDeletePattern(patternId);
            }}
            readOnly={readOnly}
          />
        )}
      </NavigableList>
    </div>
  );
};

type PatternSectionProps = {
  sectionType: SectionType;
  title: string;
  isFocused: boolean;
  patterns: TypedPattern[];
  selectedPatternId: PatternId | null;
  actionState: ActionState | undefined;
  isCreating: boolean;
  onSelectPattern: (patternId: PatternId) => void;
  onStartCreate: () => void;
  onStartRename: (patternId: PatternId) => void;
  onStartClone: (pattern: TypedPattern) => void;
  onDelete: (patternId: PatternId, patternType: PatternType) => void;
  onPatternLabelChange: (name: string) => boolean;
  onCancelAction: () => void;
  readOnly: boolean;
};

const PatternSection = ({
  sectionType,
  title,
  isFocused,
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
    <CollapsibleListSection
      sectionType={sectionType}
      title={title}
      count={patterns.length}
      isFocused={isFocused}
      action={{
        icon: <AddIcon />,
        label: translate("patterns.addPattern", title.toLocaleLowerCase()),
      }}
      onAction={onStartCreate}
      readOnly={readOnly}
    >
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
          onDelete={() => {
            onCancelAction();
            onDelete(pattern.id, pattern.type);
          }}
          onPatternLabelChange={onPatternLabelChange}
          readOnly={readOnly}
        />
      ))}
      {isCreating && (
        <ItemInput
          label="New pattern name"
          value=""
          placeholder={translate("patterns.patternName")}
          onCommit={onPatternLabelChange}
          onCancel={onCancelAction}
        />
      )}
    </CollapsibleListSection>
  );
};

type UncategorizedPatternSectionProps = {
  isFocused: boolean;
  patterns: Pattern[];
  selectedPatternId: PatternId | null;
  onSelectPattern: (patternId: PatternId) => void;
  onCategorize: (patternId: PatternId, type: SectionType) => void;
  onDelete: (patternId: PatternId) => void;
  readOnly: boolean;
};

const UncategorizedPatternSection = ({
  isFocused,
  patterns,
  selectedPatternId,
  onSelectPattern,
  onCategorize,
  onDelete,
  readOnly,
}: UncategorizedPatternSectionProps) => {
  const translate = useTranslate();

  return (
    <CollapsibleListSection
      sectionType="uncategorized"
      title={translate("patterns.uncategorizedPatterns")}
      isFocused={isFocused}
    >
      {patterns.map((pattern) => (
        <UncategorizedPatternSidebarItem
          key={pattern.id}
          pattern={pattern}
          isSelected={pattern.id === selectedPatternId}
          onSelect={() => onSelectPattern(pattern.id)}
          onCategorize={onCategorize}
          onDelete={() => onDelete(pattern.id)}
          readOnly={readOnly}
        />
      ))}
    </CollapsibleListSection>
  );
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
  readOnly = false,
}: {
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
}) => {
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

  const editMode = isRenaming ? "inline" : isCloning ? "below" : null;

  return (
    <EditableListItem
      item={pattern}
      isSelected={isSelected}
      onSelect={onSelect}
      actions={actions}
      onAction={handleAction}
      editLabelMode={editMode}
      onLabelChange={onPatternLabelChange}
      placeholder={translate("patterns.patternName")}
      onCancel={onCancel}
      readOnly={readOnly}
    />
  );
};

const UncategorizedPatternSidebarItem = ({
  pattern,
  isSelected,
  onSelect,
  onCategorize,
  onDelete,
  readOnly = false,
}: {
  pattern: Pattern;
  isSelected: boolean;
  onSelect: () => void;
  onCategorize: (patternId: PatternId, type: SectionType) => void;
  onDelete: () => void;
  readOnly?: boolean;
}) => {
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
      item={pattern}
      isSelected={isSelected}
      onSelect={onSelect}
      actions={actions}
      onAction={handleAction}
      readOnly={readOnly}
    />
  );
};
