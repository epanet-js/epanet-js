import { useState, useRef, useCallback, useMemo } from "react";
import { useTranslate } from "src/hooks/use-translate";
import {
  AddIcon,
  CloseIcon,
  DuplicateIcon,
  RenameIcon,
  WarningIcon,
} from "src/icons";
import {
  EditableListItem,
  ItemInput,
  CollapsibleListSection,
  NavigableList,
} from "src/components/list";
import type {
  ItemAction,
  NavItem,
  NavigableListHandle,
} from "src/components/list";
import type { PipeMaterial } from "@epanet-js/pipe-library";

type ActionState =
  | { action: "creating" }
  | { action: "renaming"; materialLabel: string }
  | { action: "duplicating"; sourceMaterial: PipeMaterial };

type PipeLibrarySidebarProps = {
  width: number;
  materials: PipeMaterial[];
  selectedLabel: string | null;
  invalidMaterialLabels: Set<string>;
  onSelectMaterial: (label: string | null) => void;
  onAddMaterial: (label: string) => void;
  onRenameMaterial: (oldLabel: string, newLabel: string) => void;
  onDuplicateMaterial: (sourceLabel: string, newLabel: string) => void;
  onDeleteMaterial: (label: string) => void;
};

const SECTION_TYPE = "materials";

export const PipeLibrarySidebar = ({
  width,
  materials,
  selectedLabel,
  invalidMaterialLabels,
  onSelectMaterial,
  onAddMaterial,
  onRenameMaterial,
  onDuplicateMaterial,
  onDeleteMaterial,
}: PipeLibrarySidebarProps) => {
  const translate = useTranslate();
  const listRef = useRef<NavigableListHandle>(null);
  const [actionState, setActionState] = useState<ActionState | undefined>(
    undefined,
  );
  const [focusedSection, setFocusedSection] = useState<string | null>(null);

  const navItems = useMemo(
    (): NavItem<string>[] =>
      materials.map((_, i) => ({ id: i, section: SECTION_TYPE })),
    [materials],
  );

  const focusedItem = useMemo((): NavItem<string> | undefined => {
    if (selectedLabel != null) {
      const idx = materials.findIndex((m) => m.label === selectedLabel);
      if (idx >= 0) return { id: idx, section: SECTION_TYPE };
    }
    if (focusedSection) {
      return { section: focusedSection };
    }
    return undefined;
  }, [focusedSection, selectedLabel, materials]);

  const clearActionState = () => {
    setActionState(undefined);
    requestAnimationFrame(() => listRef.current?.focus());
  };

  const handleSelectItem = useCallback(
    (item: NavItem<string>) => {
      if (item.id != null) {
        setFocusedSection(null);
        const material = materials[item.id];
        onSelectMaterial(material?.label ?? null);
      } else {
        setFocusedSection(item.section);
        onSelectMaterial(null);
      }
    },
    [onSelectMaterial, materials],
  );

  const isLabelAvailable = (label: string, excludeLabel?: string): boolean => {
    const lower = label.toLowerCase();
    return !materials.some(
      (m) => m.label !== excludeLabel && m.label.toLowerCase() === lower,
    );
  };

  const handleLabelChange = (name: string): boolean => {
    if (!actionState) return true;

    const trimmedName = name.trim();
    if (!trimmedName) return true;

    if (actionState.action === "renaming") {
      if (!isLabelAvailable(trimmedName, actionState.materialLabel))
        return true;
      onRenameMaterial(actionState.materialLabel, trimmedName);
    } else if (actionState.action === "duplicating") {
      if (!isLabelAvailable(trimmedName)) return true;
      onDuplicateMaterial(actionState.sourceMaterial.label, trimmedName);
      onSelectMaterial(trimmedName);
    } else if (actionState.action === "creating") {
      if (!isLabelAvailable(trimmedName)) return true;
      onAddMaterial(trimmedName);
      onSelectMaterial(trimmedName);
    }

    clearActionState();
    return false;
  };

  const handleNew = () => {
    setActionState({ action: "creating" });
    listRef.current?.openSection(SECTION_TYPE);
  };

  const handleAction = (
    action: string,
    item: { id: number; label: string },
  ) => {
    switch (action) {
      case "rename":
        return setActionState({
          action: "renaming",
          materialLabel: item.label,
        });
      case "duplicate": {
        const material = materials.find((m) => m.label === item.label);
        if (material) {
          setActionState({ action: "duplicating", sourceMaterial: material });
        }
        return;
      }
      case "delete": {
        clearActionState();
        onSelectMaterial(null);
        onDeleteMaterial(item.label);
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
      icon: <DuplicateIcon size="sm" />,
    },
    {
      action: "delete",
      label: translate("delete"),
      icon: <CloseIcon size="sm" />,
      variant: "destructive",
    },
  ];

  return (
    <div className="shrink-0 flex flex-col gap-2" style={{ width }}>
      <NavigableList
        ref={listRef}
        navItems={navItems}
        focusedItem={focusedItem}
        onSelectItem={handleSelectItem}
        isNavBlocked={!!actionState}
      >
        <CollapsibleListSection
          sectionType={SECTION_TYPE}
          title={translate("pipeLibrary.materials")}
          count={materials.length}
          isFocused={focusedSection === SECTION_TYPE}
          action={{
            icon: <AddIcon />,
            label: translate("pipeLibrary.materials"),
          }}
          onAction={handleNew}
        >
          {materials.map((material, i) => (
            <EditableListItem
              key={material.label}
              item={{ id: i, label: material.label }}
              isSelected={material.label === selectedLabel}
              icon={
                invalidMaterialLabels.has(material.label) && (
                  <InvalidMaterialIcon />
                )
              }
              onSelect={() =>
                handleSelectItem({ id: i, section: SECTION_TYPE })
              }
              actions={itemActions}
              onAction={handleAction}
              editLabelMode={getEditMode(actionState, material.label)}
              onLabelChange={handleLabelChange}
              placeholder={translate("pipeLibrary.materials")}
              onCancel={clearActionState}
            />
          ))}
          {actionState?.action === "creating" && (
            <ItemInput
              label="New material name"
              value=""
              placeholder={translate("pipeLibrary.materials")}
              onCommit={handleLabelChange}
              onCancel={clearActionState}
            />
          )}
        </CollapsibleListSection>
      </NavigableList>
    </div>
  );
};

const InvalidMaterialIcon = () => (
  <span className="text-warning shrink-0">
    <WarningIcon size="md" />
  </span>
);

const getEditMode = (actionState: ActionState | undefined, label: string) => {
  if (actionState?.action === "renaming" && actionState.materialLabel === label)
    return "inline";
  if (
    actionState?.action === "duplicating" &&
    actionState.sourceMaterial.label === label
  )
    return "below";
  return null;
};
