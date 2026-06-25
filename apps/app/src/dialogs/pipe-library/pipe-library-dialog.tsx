import { useState, useCallback, useRef, useMemo } from "react";
import { useAtom, useAtomValue } from "jotai";
import { BaseDialog } from "../../components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { DialogActions, DialogActionsHandle } from "../dialog-actions-row";
import { PipeLibrarySidebar } from "./pipe-library-sidebar";
import { PipeRoughnessTable } from "./pipe-roughness-table";
import { PipeErrorBanner } from "./pipe-error-banner";
import { VerticalResizer } from "../vertical-resizer";
import { PipeLibraryIcon } from "src/icons";
import { Button } from "src/components/elements";
import { notify } from "src/components/notifications";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import {
  pipeMaterialsAtom,
  selectedMaterialLabelAtom,
} from "src/state/pipe-library";
import {
  applyRoughnessMoment,
  renameMaterialsMoment,
  validateMaterial,
  DEFAULT_ROUGHNESS,
} from "src/lib/pipe-library";
import type { PipeMaterial, RoughnessEntry } from "src/lib/pipe-library";

export const PipeLibraryDialog = () => {
  const translate = useTranslate();
  const dialogActions = useRef<DialogActionsHandle>(null);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { transact } = useModelTransaction();
  const savedMaterials = useAtomValue(pipeMaterialsAtom);
  const [, setSavedMaterials] = useAtom(pipeMaterialsAtom);
  const [selectedLabel, setSelectedLabel] = useAtom(selectedMaterialLabelAtom);
  const [draftMaterials, setDraftMaterials] =
    useState<PipeMaterial[]>(savedMaterials);
  const [sidebarWidth, setSidebarWidth] = useState(224);
  const pendingRenamesRef = useRef(new Map<string, string>());

  const hasChanges = draftMaterials !== savedMaterials;

  const selectedMaterial =
    draftMaterials.find((m) => m.label === selectedLabel) ?? null;
  const isEmpty = draftMaterials.length === 0;

  const invalidMaterialLabels = useMemo(
    () =>
      new Set(
        draftMaterials
          .filter((m) => validateMaterial(m) !== null)
          .map((m) => m.label),
      ),
    [draftMaterials],
  );
  const hasValidationErrors = invalidMaterialLabels.size > 0;

  const handleSave = useCallback(() => {
    setSavedMaterials(draftMaterials);
    const renames = pendingRenamesRef.current;
    if (renames.size > 0) {
      const moment = renameMaterialsMoment(hydraulicModel, renames);
      if (moment.patchAssetsAttributes!.length > 0) {
        transact(moment);
      }
      renames.clear();
    }
  }, [draftMaterials, setSavedMaterials, hydraulicModel, transact]);

  const handleAddMaterial = useCallback((label: string) => {
    setDraftMaterials((prev) => [
      ...prev,
      { label, entries: [{ age: 0, roughness: DEFAULT_ROUGHNESS }] },
    ]);
  }, []);

  const handleRenameMaterial = useCallback(
    (oldLabel: string, newLabel: string) => {
      setDraftMaterials((prev) =>
        prev.map((m) => (m.label === oldLabel ? { ...m, label: newLabel } : m)),
      );
      setSelectedLabel((prev) => (prev === oldLabel ? newLabel : prev));

      const renames = pendingRenamesRef.current;
      let originalLabel: string | undefined;
      for (const [key, value] of renames) {
        if (value === oldLabel) {
          originalLabel = key;
          break;
        }
      }
      if (originalLabel !== undefined) {
        renames.set(originalLabel, newLabel);
      } else {
        renames.set(oldLabel, newLabel);
      }
    },
    [setSelectedLabel],
  );

  const handleDuplicateMaterial = useCallback(
    (sourceLabel: string, newLabel: string) => {
      setDraftMaterials((prev) => {
        const source = prev.find((m) => m.label === sourceLabel);
        if (!source) return prev;
        return [
          ...prev,
          { label: newLabel, entries: source.entries.map((e) => ({ ...e })) },
        ];
      });
    },
    [],
  );

  const handleDeleteMaterial = useCallback(
    (label: string) => {
      setDraftMaterials((prev) => prev.filter((m) => m.label !== label));
      if (selectedLabel === label) {
        setSelectedLabel(null);
      }

      const renames = pendingRenamesRef.current;
      for (const [key, value] of renames) {
        if (value === label) {
          renames.delete(key);
          break;
        }
      }
    },
    [selectedLabel, setSelectedLabel],
  );

  const handleEntriesChange = useCallback(
    (entries: RoughnessEntry[]) => {
      if (selectedLabel === null) return;
      setDraftMaterials((prev) =>
        prev.map((m) => (m.label === selectedLabel ? { ...m, entries } : m)),
      );
    },
    [selectedLabel],
  );

  const handleApplyRoughness = useCallback(() => {
    const moment = applyRoughnessMoment(hydraulicModel, draftMaterials);
    if (moment.patchAssetsAttributes!.length === 0) return;
    transact(moment);
    notify({
      variant: "success",
      title: translate(
        "pipeLibrary.appliedRoughness",
        moment.patchAssetsAttributes!.length,
      ),
    });
  }, [hydraulicModel, draftMaterials, transact, translate]);

  return (
    <BaseDialog
      title={translate("pipeLibrary.menuLabel")}
      size="lg"
      height="xl"
      isOpen={true}
      onClose={() => dialogActions.current?.closeDialog()}
      footer={
        <DialogActions
          ref={dialogActions}
          readOnly={false}
          hasChanges={hasChanges}
          onSave={handleSave}
          saveDisabled={invalidMaterialLabels.size > 0}
        />
      }
    >
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center px-4 py-2 border-b">
          <Button
            variant="default"
            size="sm"
            disabled={isEmpty || hasValidationErrors}
            onClick={handleApplyRoughness}
          >
            {translate("pipeLibrary.applyRoughness")}
          </Button>
        </div>
        <div className="flex-1 flex min-h-0">
          <div className="shrink-0 flex">
            <PipeLibrarySidebar
              width={sidebarWidth}
              materials={draftMaterials}
              selectedLabel={selectedLabel}
              invalidMaterialLabels={invalidMaterialLabels}
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
              <>
                <PipeRoughnessTable
                  entries={selectedMaterial.entries}
                  onChange={handleEntriesChange}
                />
                <PipeErrorBanner
                  materialLabel={selectedMaterial.label}
                  error={validateMaterial(selectedMaterial)}
                />
              </>
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
