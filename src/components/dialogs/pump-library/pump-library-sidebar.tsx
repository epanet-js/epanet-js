import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useTranslate } from "src/hooks/use-translate";
import {
  Curves,
  ICurve,
  CurveId,
  CurvePoint,
  CurveType,
  defaultCurvePoints,
} from "src/hydraulic-model/curves";
import {
  AddIcon,
  ChevronRightIcon,
  CloseIcon,
  DuplicateIcon,
  RenameIcon,
  WarningIcon,
} from "src/icons";
import { LabelManager } from "src/hydraulic-model/label-manager";
import {
  ListItem,
  ItemAction,
  ItemInput,
  EditableListItem,
  CollapsibleListSection,
  NavigableList,
} from "src/components/list";
import type { NavItem, NavigableListHandle } from "src/components/list";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

type CurveSectionType = "pump" | "efficiency";
type SidebarSectionType = CurveSectionType | "uncategorized";

type TypedCurve = ICurve & { type: CurveSectionType };

type ActionState =
  | { action: "creating"; curveType: CurveType }
  | { action: "renaming"; curveId: CurveId }
  | { action: "cloning"; sourceCurve: TypedCurve };

const SECTION_TYPES: CurveSectionType[] = ["pump", "efficiency"];

const SECTION_TRANSLATION_KEYS: Record<CurveSectionType, string> = {
  pump: "curves.pumpCurves",
  efficiency: "curves.efficiencyCurves",
};

type PumpLibrarySidebarProps = {
  width: number;
  curves: Curves;
  selectedCurveId: CurveId | null;
  initialSection?: CurveSectionType;
  labelManager: LabelManager;
  invalidCurveIds: Set<CurveId>;
  onSelectCurve: (curveId: CurveId | null) => void;
  onAddCurve: (
    label: string,
    points: CurvePoint[],
    source: "new" | "clone",
    type: CurveType,
  ) => CurveId;
  onChangeCurve: (
    curveId: CurveId,
    updates: { label?: string; type?: CurveType },
  ) => void;
  onDeleteCurve: (curveId: CurveId) => void;
  readOnly?: boolean;
};

export const PumpLibrarySidebar = ({
  width,
  curves,
  selectedCurveId,
  initialSection,
  labelManager,
  invalidCurveIds,
  onSelectCurve,
  onAddCurve,
  onChangeCurve,
  onDeleteCurve,
  readOnly = false,
}: PumpLibrarySidebarProps) => {
  const translate = useTranslate();
  const isAllCurvesEnabled = useFeatureFlag("FLAG_ALL_CURVES");
  const listRef = useRef<NavigableListHandle>(null);
  const [actionState, setActionState] = useState<ActionState | undefined>(
    undefined,
  );
  const [focusedSection, setFocusedSection] =
    useState<SidebarSectionType | null>(
      initialSection && !selectedCurveId ? initialSection : null,
    );

  const { groupedCurves, navItems } = useMemo(() => {
    const groups: Record<CurveSectionType, TypedCurve[]> = {
      pump: [],
      efficiency: [],
    };
    const uncategorized: ICurve[] = [];
    const items: NavItem<SidebarSectionType>[] = [];
    for (const curve of curves.values()) {
      const type = curve.type as CurveSectionType | undefined;
      if (type && type in groups) {
        groups[type].push(curve as TypedCurve);
        items.push({ id: curve.id, section: type });
      } else if (!curve.type) {
        uncategorized.push(curve);
        items.push({ id: curve.id, section: "uncategorized" });
      }
    }
    return {
      groupedCurves: { ...groups, uncategorized },
      navItems: items,
    };
  }, [curves]);

  const focusedItem = useMemo((): NavItem<SidebarSectionType> | undefined => {
    if (selectedCurveId) {
      const curve = curves.get(selectedCurveId);
      const section =
        curve?.type && SECTION_TYPES.includes(curve.type as CurveSectionType)
          ? (curve.type as SidebarSectionType)
          : "uncategorized";
      return { id: selectedCurveId, section };
    }
    if (focusedSection) {
      return { section: focusedSection };
    }
    return undefined;
  }, [focusedSection, selectedCurveId, curves]);

  const clearActionState = () => {
    setActionState(undefined);
    requestAnimationFrame(() => listRef.current?.focus());
  };

  useEffect(
    function autoScrollToSelectedItem() {
      if (!selectedCurveId) return;
      const item = listRef.current?.querySelector(
        `[data-item-id="${selectedCurveId}"]`,
      );
      item?.scrollIntoView({ block: "nearest" });
    },
    [selectedCurveId, curves],
  );

  const handleSelectItem = useCallback(
    (item: NavItem<SidebarSectionType>) => {
      if (item.id != null) {
        setFocusedSection(null);
        onSelectCurve(item.id);
      } else {
        setFocusedSection(item.section);
        onSelectCurve(null);
      }
    },
    [onSelectCurve],
  );

  const handleCurveLabelChange = (name: string): boolean => {
    if (!actionState) return true;

    const trimmedName = name.trim();
    if (!trimmedName) return true;

    const excludeId =
      actionState.action === "renaming" ? actionState.curveId : undefined;
    if (!labelManager.isLabelAvailable(trimmedName, "curve", excludeId)) {
      return true;
    }

    if (actionState.action === "renaming") {
      onChangeCurve(actionState.curveId, { label: trimmedName });
    } else if (actionState.action === "cloning") {
      const points = actionState.sourceCurve.points.map((p) => ({ ...p }));
      const newId = onAddCurve(
        trimmedName,
        points,
        "clone",
        actionState.sourceCurve.type,
      );
      onSelectCurve(newId);
    } else if (actionState.action === "creating") {
      const newId = onAddCurve(
        trimmedName,
        defaultCurvePoints(),
        "new",
        actionState.curveType,
      );
      onSelectCurve(newId);
    }

    clearActionState();
    return false;
  };

  const handleCategorize = useCallback(
    (curveId: CurveId, type: CurveSectionType) => {
      onChangeCurve(curveId, { type });
    },
    [onChangeCurve],
  );

  const handleNew = (sectionType: string) => {
    setActionState({
      action: "creating",
      curveType: sectionType as CurveSectionType,
    });
    listRef.current?.openSection(sectionType);
  };

  const handleAction = (action: string, curve: ICurve) => {
    switch (action) {
      case "rename":
        return setActionState({
          action: "renaming",
          curveId: curve.id,
        });
      case "duplicate":
        return setActionState({
          action: "cloning",
          sourceCurve: curve as TypedCurve,
        });
      case "categorizePump":
        return handleCategorize(curve.id, "pump");
      case "categorizeEfficiency":
        return handleCategorize(curve.id, "efficiency");
      case "delete": {
        clearActionState();
        onSelectCurve(null);
        onDeleteCurve(curve.id);
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
      action: "categorizePump",
      label: translate("curves.setAsPump"),
      icon: <ChevronRightIcon size="sm" />,
    },
    ...(isAllCurvesEnabled
      ? [
          {
            action: "categorizeEfficiency",
            label: translate("curves.setAsEfficiency"),
            icon: <ChevronRightIcon size="sm" />,
          },
        ]
      : []),
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
        {SECTION_TYPES.filter(
          (type) => type !== "efficiency" || isAllCurvesEnabled,
        ).map((sectionType) => {
          const title = translate(SECTION_TRANSLATION_KEYS[sectionType]);
          return (
            <CollapsibleListSection
              key={sectionType}
              sectionType={sectionType}
              title={title}
              count={groupedCurves[sectionType].length}
              isFocused={focusedSection === sectionType}
              action={{
                icon: <AddIcon />,
                label: translate("curves.addCurve", title.toLocaleLowerCase()),
              }}
              onAction={handleNew}
              readOnly={readOnly}
            >
              {groupedCurves[sectionType].map((curve) => {
                return (
                  <EditableListItem
                    key={curve.id}
                    item={curve}
                    isSelected={curve.id === selectedCurveId}
                    icon={invalidCurveIds.has(curve.id) && <InvalidCurveIcon />}
                    onSelect={() =>
                      handleSelectItem({ id: curve.id, section: sectionType })
                    }
                    actions={itemActions}
                    onAction={handleAction}
                    editLabelMode={getEditMode(actionState, curve.id)}
                    onLabelChange={handleCurveLabelChange}
                    placeholder={translate("curves.curveName")}
                    onCancel={clearActionState}
                    readOnly={readOnly}
                  />
                );
              })}
              {isCreatingInSection(actionState, sectionType) && (
                <ItemInput
                  label="New curve name"
                  value=""
                  placeholder={translate("curves.curveName")}
                  onCommit={handleCurveLabelChange}
                  onCancel={clearActionState}
                />
              )}
            </CollapsibleListSection>
          );
        })}
        {groupedCurves.uncategorized.length > 0 && (
          <CollapsibleListSection
            sectionType="uncategorized"
            title={translate("curves.uncategorizedCurves")}
            count={groupedCurves.uncategorized.length}
            isFocused={focusedSection === "uncategorized"}
          >
            {groupedCurves.uncategorized.map((curve) => {
              return (
                <ListItem
                  key={curve.id}
                  item={curve}
                  isSelected={curve.id === selectedCurveId}
                  onSelect={() =>
                    handleSelectItem({ id: curve.id, section: "uncategorized" })
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

const getEditMode = (actionState: ActionState | undefined, id: CurveId) => {
  const isRenaming =
    actionState?.action === "renaming" && actionState.curveId === id;
  if (isRenaming) return "inline";

  const isCloning =
    actionState?.action === "cloning" && actionState.sourceCurve.id === id;
  if (isCloning) return "below";

  return null;
};

const isCreatingInSection = (
  actionState: ActionState | undefined,
  curveType: CurveType,
) => {
  if (actionState?.action !== "creating") return false;
  return actionState.curveType === curveType;
};

const InvalidCurveIcon = () => (
  <span className="text-orange-500 flex-shrink-0">
    <WarningIcon size="sm" />
  </span>
);
