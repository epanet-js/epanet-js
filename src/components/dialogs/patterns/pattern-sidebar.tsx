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

  const focusedItem = useMemo((): NavItem<SidebarSectionType> | undefined => {
    if (selectedPatternId) {
      const pattern = patterns.get(selectedPatternId);
      const section =
        pattern?.type && SECTION_TYPES.includes(pattern.type as SectionType)
          ? (pattern.type as SidebarSectionType)
          : "uncategorized";
      return { id: selectedPatternId, section };
    }
    if (focusedSection) {
      return { section: focusedSection };
    }
    return undefined;
  }, [focusedSection, selectedPatternId, patterns]);

  const clearActionState = () => {
    setActionState(undefined);
    requestAnimationFrame(() => listRef.current?.focus());
  };

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

  const handleCategorize = useCallback(
    (patternId: PatternId, type: SectionType) => {
      onChangePattern(patternId, { type });
      userTracking.capture({ name: "pattern.changed", property: "type" });
    },
    [onChangePattern, userTracking],
  );

  const handleNew = (sectionType: string) => {
    setActionState({
      action: "creating",
      patternType: sectionType as SectionType,
    });
    listRef.current?.openSection(sectionType);
  };

  const handleAction = (action: string, pattern: Pattern) => {
    switch (action) {
      case "rename":
        return setActionState({
          action: "renaming",
          patternId: pattern.id,
        });
      case "duplicate":
        return setActionState({
          action: "cloning",
          sourcePattern: pattern as TypedPattern,
        });
      case "setAsDemand":
        return handleCategorize(pattern.id, "demand");
      case "setAsReservoirHead":
        return handleCategorize(pattern.id, "reservoirHead");
      case "setAsPumpSpeed":
        return handleCategorize(pattern.id, "pumpSpeed");
      case "delete": {
        clearActionState();
        onSelectPattern(null);
        onDeletePattern(pattern.id, pattern.type);
        return;
      }
    }
  };

  const itemActions: ItemAction[] = [
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

  const uncategorizedItemActions: ItemAction[] = [
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

  return (
    <div className="flex-shrink-0 flex flex-col gap-2" style={{ width }}>
      <NavigableList
        ref={listRef}
        navItems={navItems}
        focusedItem={focusedItem}
        onSelectItem={handleSelectItem}
        isNavBlocked={!!actionState}
      >
        {SECTION_TYPES.map((sectionType) => {
          const title = translate(SECTION_TRANSLATION_KEYS[sectionType]);
          return (
            <CollapsibleListSection
              key={sectionType}
              sectionType={sectionType}
              title={title}
              count={groupedPatterns[sectionType].length}
              isFocused={focusedSection === sectionType}
              action={{
                icon: <AddIcon />,
                label: translate(
                  "patterns.addPattern",
                  title.toLocaleLowerCase(),
                ),
              }}
              onAction={handleNew}
              readOnly={readOnly}
            >
              {groupedPatterns[sectionType].map((pattern) => {
                return (
                  <EditableListItem
                    key={pattern.id}
                    item={pattern}
                    isSelected={pattern.id === selectedPatternId}
                    onSelect={() =>
                      handleSelectItem({ id: pattern.id, section: sectionType })
                    }
                    actions={itemActions}
                    onAction={handleAction}
                    editLabelMode={getEditMode(actionState, pattern.id)}
                    onLabelChange={handlePatternLabelChange}
                    placeholder={translate("patterns.patternName")}
                    onCancel={clearActionState}
                    readOnly={readOnly}
                  />
                );
              })}
              {isCreatingInSection(actionState, sectionType) && (
                <ItemInput
                  label="New pattern name"
                  value=""
                  placeholder={translate("patterns.patternName")}
                  onCommit={handlePatternLabelChange}
                  onCancel={clearActionState}
                />
              )}
            </CollapsibleListSection>
          );
        })}
        {groupedPatterns.uncategorized.length > 0 && (
          <CollapsibleListSection
            sectionType="uncategorized"
            title={translate("patterns.uncategorizedPatterns")}
            isFocused={focusedSection === "uncategorized"}
          >
            {groupedPatterns.uncategorized.map((pattern) => {
              return (
                <ListItem
                  key={pattern.id}
                  item={pattern}
                  isSelected={pattern.id === selectedPatternId}
                  onSelect={() =>
                    handleSelectItem({
                      id: pattern.id,
                      section: "uncategorized",
                    })
                  }
                  actions={uncategorizedItemActions}
                  onAction={handleAction}
                  readOnly={readOnly}
                />
              );
            })}
          </CollapsibleListSection>
        )}
      </NavigableList>
    </div>
  );
};

const getEditMode = (actionState: ActionState | undefined, id: PatternId) => {
  const isRenaming =
    actionState?.action === "renaming" && actionState.patternId === id;
  if (isRenaming) return "inline";

  const isCloning =
    actionState?.action === "cloning" && actionState.sourcePattern.id === id;
  if (isCloning) return "below";

  return null;
};

const isCreatingInSection = (
  actionState: ActionState | undefined,
  patternType: PatternType,
) => {
  if (actionState?.action !== "creating") return false;
  return actionState.patternType === patternType;
};
