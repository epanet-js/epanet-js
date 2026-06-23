import { useState, useCallback, useRef } from "react";
import { useAtom } from "jotai";
import { BaseDialog } from "../../components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { DialogActions, DialogActionsHandle } from "../dialog-actions-row";
import { PipeLibrarySidebar } from "./pipe-library-sidebar";
import { PipeRoughnessTable } from "./pipe-roughness-table";
import { VerticalResizer } from "../vertical-resizer";
import { PipeLibraryIcon } from "src/icons";
import { Button } from "src/components/elements";
import {
  pipeMaterialsAtom,
  selectedMaterialLabelAtom,
} from "src/state/pipe-library";
import type { RoughnessEntry } from "./types";

export const PipeLibraryDialog = () => {
  const translate = useTranslate();
  const dialogActions = useRef<DialogActionsHandle>(null);
  const [materials, setMaterials] = useAtom(pipeMaterialsAtom);
  const [selectedLabel, setSelectedLabel] = useAtom(selectedMaterialLabelAtom);
  const [sidebarWidth, setSidebarWidth] = useState(224);

  const selectedMaterial =
    materials.find((m) => m.label === selectedLabel) ?? null;
  const isEmpty = materials.length === 0;

  const handleAddMaterial = useCallback(
    (label: string) => {
      setMaterials((prev) => [...prev, { label, entries: [] }]);
    },
    [setMaterials],
  );

  const handleRenameMaterial = useCallback(
    (oldLabel: string, newLabel: string) => {
      setMaterials((prev) =>
        prev.map((m) => (m.label === oldLabel ? { ...m, label: newLabel } : m)),
      );
      setSelectedLabel((prev) => (prev === oldLabel ? newLabel : prev));
    },
    [setMaterials, setSelectedLabel],
  );

  const handleDuplicateMaterial = useCallback(
    (sourceLabel: string, newLabel: string) => {
      const source = materials.find((m) => m.label === sourceLabel);
      if (!source) return;
      setMaterials((prev) => [
        ...prev,
        { label: newLabel, entries: source.entries.map((e) => ({ ...e })) },
      ]);
    },
    [materials, setMaterials],
  );

  const handleDeleteMaterial = useCallback(
    (label: string) => {
      setMaterials((prev) => prev.filter((m) => m.label !== label));
      if (selectedLabel === label) {
        setSelectedLabel(null);
      }
    },
    [selectedLabel, setMaterials, setSelectedLabel],
  );

  const handleEntriesChange = useCallback(
    (entries: RoughnessEntry[]) => {
      if (selectedLabel === null) return;
      setMaterials((prev) =>
        prev.map((m) => (m.label === selectedLabel ? { ...m, entries } : m)),
      );
    },
    [selectedLabel, setMaterials],
  );

  return (
    <BaseDialog
      title={translate("pipeLibrary.menuLabel")}
      size="md"
      height="lg"
      isOpen={true}
      onClose={() => dialogActions.current?.closeDialog()}
      footer={
        <DialogActions
          ref={dialogActions}
          readOnly={false}
          hasChanges={false}
        />
      }
    >
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center px-4 py-2 border-b">
          <Button variant="default" size="sm" disabled={isEmpty}>
            {translate("pipeLibrary.applyRoughness")}
          </Button>
        </div>
        <div className="flex-1 flex min-h-0">
          <div className="shrink-0 flex">
            <PipeLibrarySidebar
              width={sidebarWidth}
              materials={materials}
              selectedLabel={selectedLabel}
              onSelectMaterial={setSelectedLabel}
              onAddMaterial={handleAddMaterial}
              onRenameMaterial={handleRenameMaterial}
              onDuplicateMaterial={handleDuplicateMaterial}
              onDeleteMaterial={handleDeleteMaterial}
            />
            <VerticalResizer
              width={sidebarWidth}
              onWidthChange={setSidebarWidth}
            />
          </div>
          <div className="flex-1 flex flex-col min-h-0 w-full">
            {selectedMaterial ? (
              <PipeRoughnessTable
                entries={selectedMaterial.entries}
                onChange={handleEntriesChange}
              />
            ) : isEmpty ? (
              <div className="flex-1 flex items-center justify-center p-2">
                <EmptyState />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-2">
                <NoSelectionState />
              </div>
            )}
          </div>
        </div>
      </div>
    </BaseDialog>
  );
};

const NoSelectionState = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col items-center justify-center px-4">
      <div className="text-subtle">
        <PipeLibraryIcon size={96} />
      </div>
      <p className="text-size-base text-subtle text-center max-w-64 py-4">
        {translate("pipeLibrary.noSelection")}
      </p>
    </div>
  );
};

const EmptyState = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col items-center justify-center px-4">
      <div className="text-subtle">
        <PipeLibraryIcon size={96} />
      </div>
      <p className="text-size-base font-semibold py-4 text-subtle">
        {translate("pipeLibrary.emptyTitle")}
      </p>
      <p className="text-size-base text-subtle text-center max-w-64">
        {translate("pipeLibrary.emptyDescription")}
      </p>
    </div>
  );
};
