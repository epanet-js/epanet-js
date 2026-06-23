import { useState, useCallback, useRef } from "react";
import { BaseDialog } from "../../components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { DialogActions, DialogActionsHandle } from "../dialog-actions-row";
import { PipeLibrarySidebar } from "./pipe-library-sidebar";
import { PipeRoughnessTable } from "./pipe-roughness-table";
import { VerticalResizer } from "../vertical-resizer";
import { PipeLibraryIcon } from "src/icons";
import { Button } from "src/components/elements";
import { PipeMaterial, RoughnessEntry } from "./types";

let nextId = 1;

export const PipeLibraryDialog = () => {
  const translate = useTranslate();
  const dialogActions = useRef<DialogActionsHandle>(null);
  const [materials, setMaterials] = useState<PipeMaterial[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | null>(
    null,
  );
  const [sidebarWidth, setSidebarWidth] = useState(224);

  const selectedMaterial =
    materials.find((m) => m.id === selectedMaterialId) ?? null;
  const isEmpty = materials.length === 0;

  const handleAddMaterial = useCallback((label: string): number => {
    const id = nextId++;
    setMaterials((prev) => [...prev, { id, label, entries: [] }]);
    return id;
  }, []);

  const handleRenameMaterial = useCallback((id: number, label: string) => {
    setMaterials((prev) =>
      prev.map((m) => (m.id === id ? { ...m, label } : m)),
    );
  }, []);

  const handleDuplicateMaterial = useCallback(
    (sourceId: number, label: string): number => {
      const source = materials.find((m) => m.id === sourceId);
      if (!source) return -1;
      const id = nextId++;
      setMaterials((prev) => [
        ...prev,
        { id, label, entries: source.entries.map((e) => ({ ...e })) },
      ]);
      return id;
    },
    [materials],
  );

  const handleDeleteMaterial = useCallback(
    (id: number) => {
      setMaterials((prev) => prev.filter((m) => m.id !== id));
      if (selectedMaterialId === id) {
        setSelectedMaterialId(null);
      }
    },
    [selectedMaterialId],
  );

  const handleEntriesChange = useCallback(
    (entries: RoughnessEntry[]) => {
      if (selectedMaterialId === null) return;
      setMaterials((prev) =>
        prev.map((m) => (m.id === selectedMaterialId ? { ...m, entries } : m)),
      );
    },
    [selectedMaterialId],
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
              selectedMaterialId={selectedMaterialId}
              onSelectMaterial={setSelectedMaterialId}
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
