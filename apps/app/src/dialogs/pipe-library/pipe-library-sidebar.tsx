import { useState, useRef, useCallback, useMemo } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { AddIcon, CloseIcon, DuplicateIcon, RenameIcon } from "src/icons";
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
import { PipeMaterial } from "./types";

type ActionState =
  | { action: "creating" }
  | { action: "renaming"; materialId: number }
  | { action: "duplicating"; sourceMaterial: PipeMaterial };

type PipeLibrarySidebarProps = {
  width: number;
  materials: PipeMaterial[];
  selectedMaterialId: number | null;
  onSelectMaterial: (id: number | null) => void;
  onAddMaterial: (label: string) => number;
  onRenameMaterial: (id: number, label: string) => void;
  onDuplicateMaterial: (sourceId: number, label: string) => number;
  onDeleteMaterial: (id: number) => void;
};

const SECTION_TYPE = "materials";

export const PipeLibrarySidebar = ({
  width,
  materials,
  selectedMaterialId,
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
      materials.map((m) => ({ id: m.id, section: SECTION_TYPE })),
    [materials],
  );

  const focusedItem = useMemo((): NavItem<string> | undefined => {
    if (selectedMaterialId != null) {
      return { id: selectedMaterialId, section: SECTION_TYPE };
    }
    if (focusedSection) {
      return { section: focusedSection };
    }
    return undefined;
  }, [focusedSection, selectedMaterialId]);

  const clearActionState = () => {
    setActionState(undefined);
    requestAnimationFrame(() => listRef.current?.focus());
  };

  const handleSelectItem = useCallback(
    (item: NavItem<string>) => {
      if (item.id != null) {
        setFocusedSection(null);
        onSelectMaterial(item.id);
      } else {
        setFocusedSection(item.section);
        onSelectMaterial(null);
      }
    },
    [onSelectMaterial],
  );

  const isLabelAvailable = (label: string, excludeId?: number): boolean => {
    const lower = label.toLowerCase();
    return !materials.some(
      (m) => m.id !== excludeId && m.label.toLowerCase() === lower,
    );
  };

  const handleLabelChange = (name: string): boolean => {
    if (!actionState) return true;

    const trimmedName = name.trim();
    if (!trimmedName) return true;

    if (actionState.action === "renaming") {
      if (!isLabelAvailable(trimmedName, actionState.materialId)) return true;
      onRenameMaterial(actionState.materialId, trimmedName);
    } else if (actionState.action === "duplicating") {
      if (!isLabelAvailable(trimmedName)) return true;
      const newId = onDuplicateMaterial(
        actionState.sourceMaterial.id,
        trimmedName,
      );
      onSelectMaterial(newId);
    } else if (actionState.action === "creating") {
      if (!isLabelAvailable(trimmedName)) return true;
      const newId = onAddMaterial(trimmedName);
      onSelectMaterial(newId);
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
        return setActionState({ action: "renaming", materialId: item.id });
      case "duplicate": {
        const material = materials.find((m) => m.id === item.id);
        if (material) {
          setActionState({ action: "duplicating", sourceMaterial: material });
        }
        return;
      }
      case "delete": {
        clearActionState();
        onSelectMaterial(null);
        onDeleteMaterial(item.id);
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
          {materials.map((material) => (
            <EditableListItem
              key={material.id}
              item={material}
              isSelected={material.id === selectedMaterialId}
              onSelect={() =>
                handleSelectItem({ id: material.id, section: SECTION_TYPE })
              }
              actions={itemActions}
              onAction={handleAction}
              editLabelMode={getEditMode(actionState, material.id)}
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

const getEditMode = (actionState: ActionState | undefined, id: number) => {
  if (actionState?.action === "renaming" && actionState.materialId === id)
    return "inline";
  if (
    actionState?.action === "duplicating" &&
    actionState.sourceMaterial.id === id
  )
    return "below";
  return null;
};
