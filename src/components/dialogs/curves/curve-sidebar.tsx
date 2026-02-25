import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import * as C from "@radix-ui/react-collapsible";
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
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  DuplicateIcon,
  RenameIcon,
  WarningIcon,
} from "src/icons";
import { Button } from "src/components/elements";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { ListItem, ItemAction, ItemInput } from "src/components/list";

type CurveSectionType = "pump";
type SidebarSectionType = CurveSectionType | "uncategorized";

type TypedCurve = ICurve & { type: CurveSectionType };

type ActionState =
  | { action: "creating"; curveType: CurveType }
  | { action: "renaming"; curveId: CurveId }
  | { action: "cloning"; sourceCurve: TypedCurve };

type NavItem =
  | { kind: "section"; sectionType: SidebarSectionType }
  | { kind: "curve"; curveId: CurveId };

type CurveSidebarProps = {
  width: number;
  curves: Curves;
  selectedCurveId: CurveId | null;
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

export const CurveSidebar = ({
  width,
  curves,
  selectedCurveId,
  labelManager,
  invalidCurveIds,
  onSelectCurve,
  onAddCurve,
  onChangeCurve,
  onDeleteCurve,
  readOnly = false,
}: CurveSidebarProps) => {
  const translate = useTranslate();
  const listRef = useRef<HTMLDivElement>(null);
  const [actionState, setActionState] = useState<ActionState | undefined>(
    undefined,
  );
  const [focusedSection, setFocusedSection] =
    useState<SidebarSectionType | null>(null);
  const [openSections, setOpenSections] = useState<
    Record<SidebarSectionType, boolean>
  >({
    pump: true,
    uncategorized: true,
  });

  const clearActionState = () => {
    setActionState(undefined);
    requestAnimationFrame(() => listRef.current?.focus());
  };

  const handleScroll = useCallback(() => {
    listRef.current?.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
  }, []);

  const groupedCurves = useMemo(() => {
    const pump: TypedCurve[] = [];
    const uncategorized: ICurve[] = [];
    for (const curve of curves.values()) {
      if (curve.type === "pump") {
        pump.push(curve as TypedCurve);
      } else {
        uncategorized.push(curve);
      }
    }
    return { pump, uncategorized };
  }, [curves]);

  const navItems = useMemo(() => {
    const items: NavItem[] = [];
    items.push({ kind: "section", sectionType: "pump" });
    if (openSections.pump) {
      for (const c of groupedCurves.pump) {
        items.push({ kind: "curve", curveId: c.id });
      }
    }
    if (groupedCurves.uncategorized.length > 0) {
      items.push({ kind: "section", sectionType: "uncategorized" });
      if (openSections.uncategorized) {
        for (const c of groupedCurves.uncategorized) {
          items.push({ kind: "curve", curveId: c.id });
        }
      }
    }
    return items;
  }, [openSections, groupedCurves]);

  useEffect(
    function autoScrollToSelectedItem() {
      if (!selectedCurveId) return;
      const item = listRef.current?.querySelector(
        `[data-curve-id="${selectedCurveId}"]`,
      );
      item?.scrollIntoView({ block: "nearest" });
    },
    [selectedCurveId, curves],
  );

  const toggleSection = useCallback((sectionType: SidebarSectionType) => {
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
    if (selectedCurveId) {
      return navItems.findIndex(
        (item) => item.kind === "curve" && item.curveId === selectedCurveId,
      );
    }
    return -1;
  }, [focusedSection, selectedCurveId, navItems]);

  const navigateToItem = useCallback(
    (item: NavItem) => {
      if (item.kind === "section") {
        setFocusedSection(item.sectionType);
        onSelectCurve(null);
        const el = listRef.current?.querySelector(
          `[data-section-type="${item.sectionType}"]`,
        );
        el?.scrollIntoView({ block: "nearest" });
      } else {
        setFocusedSection(null);
        onSelectCurve(item.curveId);
        const el = listRef.current?.querySelector(
          `[data-curve-id="${item.curveId}"]`,
        );
        el?.scrollIntoView({ block: "nearest" });
      }
    },
    [onSelectCurve],
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

      if (e.key === "Escape" && selectedCurveId) {
        e.preventDefault();
        e.stopPropagation();
        const curve = curves.get(selectedCurveId);
        const sectionType: SidebarSectionType =
          curve?.type === "pump" ? "pump" : "uncategorized";
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

      const itemHeight = 32;
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
      selectedCurveId,
      curves,
      navItems,
      currentNavIndex,
      toggleSection,
      navigateToItem,
    ],
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

  const creatingInSection =
    actionState?.action === "creating" ? actionState.curveType : undefined;

  const handleCategorize = useCallback(
    (curveId: CurveId) => {
      onChangeCurve(curveId, { type: "pump" });
    },
    [onChangeCurve],
  );

  return (
    <div className="flex-shrink-0 flex flex-col gap-2" style={{ width }}>
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto outline-none placemark-scrollbar scroll-shadows border border-gray-200 dark:border-gray-700 rounded"
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        tabIndex={0}
        {...(selectedCurveId != null && {
          "data-capture-escape-key": true,
        })}
      >
        <CurveSection
          title={translate("curves.pumpCurves")}
          isOpen={openSections.pump}
          isFocused={focusedSection === "pump"}
          onToggle={() => toggleSection("pump")}
          curves={groupedCurves.pump}
          selectedCurveId={selectedCurveId}
          invalidCurveIds={invalidCurveIds}
          actionState={actionState}
          isCreating={creatingInSection === "pump"}
          onSelectCurve={(curveId) => {
            setFocusedSection(null);
            onSelectCurve(curveId);
          }}
          onStartCreate={() => {
            setActionState({ action: "creating", curveType: "pump" });
            setOpenSections((prev) => ({ ...prev, pump: true }));
          }}
          onStartRename={(curveId) =>
            setActionState({ action: "renaming", curveId })
          }
          onStartClone={(sourceCurve) =>
            setActionState({ action: "cloning", sourceCurve })
          }
          onDelete={(curveId) => {
            onSelectCurve(null);
            onDeleteCurve(curveId);
          }}
          onCurveLabelChange={handleCurveLabelChange}
          onCancelAction={clearActionState}
          readOnly={readOnly}
        />
        {groupedCurves.uncategorized.length > 0 && (
          <UncategorizedCurveSection
            isOpen={openSections.uncategorized}
            isFocused={focusedSection === "uncategorized"}
            onToggle={() => toggleSection("uncategorized")}
            curves={groupedCurves.uncategorized}
            selectedCurveId={selectedCurveId}
            onSelectCurve={(curveId) => {
              setFocusedSection(null);
              onSelectCurve(curveId);
            }}
            onCategorize={handleCategorize}
            onDelete={(curveId) => {
              clearActionState();
              onSelectCurve(null);
              onDeleteCurve(curveId);
            }}
            readOnly={readOnly}
          />
        )}
      </div>
    </div>
  );
};

// --- Pump Section ---

type CurveSectionProps = {
  title: string;
  isOpen: boolean;
  isFocused: boolean;
  onToggle: () => void;
  curves: TypedCurve[];
  selectedCurveId: CurveId | null;
  invalidCurveIds: Set<CurveId>;
  actionState: ActionState | undefined;
  isCreating: boolean;
  onSelectCurve: (curveId: CurveId) => void;
  onStartCreate: () => void;
  onStartRename: (curveId: CurveId) => void;
  onStartClone: (sourceCurve: TypedCurve) => void;
  onDelete: (curveId: CurveId) => void;
  onCurveLabelChange: (name: string) => boolean;
  onCancelAction: () => void;
  readOnly: boolean;
};

const CurveSection = ({
  title,
  isOpen,
  isFocused,
  onToggle,
  curves,
  selectedCurveId,
  invalidCurveIds,
  actionState,
  isCreating,
  onSelectCurve,
  onStartCreate,
  onStartRename,
  onStartClone,
  onDelete,
  onCurveLabelChange,
  onCancelAction,
  readOnly,
}: CurveSectionProps) => {
  const translate = useTranslate();

  return (
    <C.Root open={isOpen} onOpenChange={onToggle}>
      <div
        data-section-type="pump"
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
            <span className="shrink-0">({curves.length})</span>
          </button>
        </C.Trigger>
        {!readOnly && (
          <Button
            variant="quiet"
            size="xs"
            aria-label={translate("curves.addCurve", title.toLocaleLowerCase())}
            onClick={onStartCreate}
            className="h-6 w-6 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <AddIcon />
          </Button>
        )}
      </div>
      <C.Content>
        <ul className="pl-4">
          {curves.map((curve) => (
            <CurveSidebarItem
              key={curve.id}
              curve={curve}
              isSelected={curve.id === selectedCurveId}
              isInvalid={invalidCurveIds.has(curve.id)}
              onSelect={() => onSelectCurve(curve.id)}
              actionState={actionState}
              onCancel={onCancelAction}
              onStartRename={onStartRename}
              onStartClone={onStartClone}
              onDelete={() => {
                onCancelAction();
                onDelete(curve.id);
              }}
              onCurveLabelChange={onCurveLabelChange}
              readOnly={readOnly}
            />
          ))}
          {isCreating && (
            <ItemInput
              label="New curve name"
              value=""
              placeholder={translate("curves.curveName")}
              onCommit={onCurveLabelChange}
              onCancel={onCancelAction}
            />
          )}
        </ul>
      </C.Content>
    </C.Root>
  );
};

// --- Uncategorized Section ---

type UncategorizedCurveSectionProps = {
  isOpen: boolean;
  isFocused: boolean;
  onToggle: () => void;
  curves: ICurve[];
  selectedCurveId: CurveId | null;
  onSelectCurve: (curveId: CurveId) => void;
  onCategorize: (curveId: CurveId) => void;
  onDelete: (curveId: CurveId) => void;
  readOnly: boolean;
};

const UncategorizedCurveSection = ({
  isOpen,
  isFocused,
  onToggle,
  curves,
  selectedCurveId,
  onSelectCurve,
  onCategorize,
  onDelete,
  readOnly,
}: UncategorizedCurveSectionProps) => {
  const translate = useTranslate();

  return (
    <C.Root open={isOpen} onOpenChange={onToggle}>
      <div
        data-section-type="uncategorized"
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
            <span className="truncate">
              {translate("curves.uncategorizedCurves")}
            </span>
            <span className="shrink-0">({curves.length})</span>
          </button>
        </C.Trigger>
      </div>
      <C.Content>
        <ul className="pl-4">
          {curves.map((curve) => (
            <UncategorizedCurveSidebarItem
              key={curve.id}
              curve={curve}
              isSelected={curve.id === selectedCurveId}
              onSelect={() => onSelectCurve(curve.id)}
              onCategorize={onCategorize}
              onDelete={() => onDelete(curve.id)}
              readOnly={readOnly}
            />
          ))}
        </ul>
      </C.Content>
    </C.Root>
  );
};

// --- Sidebar Items ---

type CurveSidebarItemProps = {
  curve: TypedCurve;
  isSelected: boolean;
  isInvalid: boolean;
  onSelect: () => void;
  actionState: ActionState | undefined;
  onCancel: () => void;
  onStartRename: (curveId: CurveId) => void;
  onStartClone: (curve: TypedCurve) => void;
  onDelete: () => void;
  onCurveLabelChange: (name: string) => boolean;
  readOnly?: boolean;
};

const CurveSidebarItem = ({
  curve,
  isSelected,
  isInvalid,
  onSelect,
  actionState,
  onCancel,
  onStartRename,
  onStartClone,
  onDelete,
  onCurveLabelChange,
  readOnly = false,
}: CurveSidebarItemProps) => {
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
        return onStartRename(curve.id);
      case "duplicate":
        return onStartClone(curve);
      case "delete":
        return onDelete();
    }
  };

  const isRenaming =
    actionState?.action === "renaming" && actionState.curveId === curve.id;
  const isCloning =
    actionState?.action === "cloning" &&
    actionState.sourceCurve.id === curve.id;

  if (isRenaming) {
    return (
      <ItemInput
        label="Rename curve"
        value={curve.label}
        onCommit={onCurveLabelChange}
        onCancel={onCancel}
      />
    );
  }

  const warningIcon = isInvalid ? (
    <span className="text-orange-500 flex-shrink-0">
      <WarningIcon size="sm" />
    </span>
  ) : null;

  return (
    <>
      <ListItem
        id={curve.id}
        label={curve.label}
        isSelected={isSelected}
        onSelect={onSelect}
        icon={warningIcon}
        actions={readOnly ? undefined : actions}
        onAction={readOnly ? undefined : handleAction}
      />
      {isCloning && (
        <ItemInput
          label="Clone curve name"
          value={curve.label}
          placeholder={translate("curves.curveName")}
          onCommit={onCurveLabelChange}
          onCancel={onCancel}
          forceValidation
        />
      )}
    </>
  );
};

type UncategorizedCurveSidebarItemProps = {
  curve: ICurve;
  isSelected: boolean;
  onSelect: () => void;
  onCategorize: (curveId: CurveId) => void;
  onDelete: () => void;
  readOnly?: boolean;
};

const UncategorizedCurveSidebarItem = ({
  curve,
  isSelected,
  onSelect,
  onCategorize,
  onDelete,
  readOnly = false,
}: UncategorizedCurveSidebarItemProps) => {
  const translate = useTranslate();

  const actions: ItemAction[] = [
    {
      action: "categorizePump",
      label: translate("curves.setAsPump"),
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
      case "categorizePump":
        return onCategorize(curve.id);
      case "delete":
        return onDelete();
    }
  };

  return (
    <ListItem
      id={curve.id}
      label={curve.label}
      isSelected={isSelected}
      onSelect={onSelect}
      actions={readOnly ? undefined : actions}
      onAction={handleAction}
    />
  );
};
