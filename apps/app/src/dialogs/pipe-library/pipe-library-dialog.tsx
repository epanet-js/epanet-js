import { useState, useCallback, useRef, useMemo } from "react";
import { useAtom, useAtomValue } from "jotai";
import * as DD from "@radix-ui/react-dropdown-menu";
import { BaseDialog } from "../../components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useUserTracking } from "src/infra/user-tracking";
import { DialogActions, DialogActionsHandle } from "../dialog-actions-row";
import { PipeLibrarySidebar } from "./pipe-library-sidebar";
import { PipeRoughnessTable } from "./pipe-roughness-table";
import { PipeErrorBanner } from "./pipe-error-banner";
import { VerticalResizer } from "../vertical-resizer";
import { ChevronDownIcon, PipeLibraryIcon } from "src/icons";
import { Button, DDContent, StyledItem } from "src/components/elements";
import { notify } from "src/components/notifications";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { projectSettingsAtom } from "src/state/project-settings";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { currentFileNameAtom } from "src/state/file-system";
import { usePipeLibraryTransaction } from "src/hooks/persistence/use-pipe-library-transaction";
import {
  pipeMaterialsAtom,
  selectedMaterialLabelAtom,
} from "src/state/pipe-library";
import {
  applyRoughnessMoment,
  renameMaterialsMoment,
  exportXlsx,
} from "src/lib/pipe-library";
import {
  validateMaterial,
  detectModelMaterials,
  DEFAULT_ROUGHNESS_HW,
  DEFAULT_ROUGHNESS_DW_CM,
} from "@epanet-js/pipe-library";
import type { PipeMaterial, RoughnessEntry } from "@epanet-js/pipe-library";

export const PipeLibraryDialog = () => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const dialogActions = useRef<DialogActionsHandle>(null);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const projectSettings = useAtomValue(projectSettingsAtom);
  const { transact } = useMomentTransaction();
  const savedMaterials = useAtomValue(pipeMaterialsAtom);
  const { transact: transactPipeLibrary } = usePipeLibraryTransaction();
  const [selectedLabel, setSelectedLabel] = useAtom(selectedMaterialLabelAtom);
  const [draftMaterials, setDraftMaterials] =
    useState<PipeMaterial[]>(savedMaterials);
  const [sidebarWidth, setSidebarWidth] = useState(224);
  const pendingRenamesRef = useRef(new Map<string, string>());

  const fullNetworkName = useAtomValue(currentFileNameAtom) ?? "";
  const networkName = useMemo(() => {
    const dot = fullNetworkName.lastIndexOf(".");
    return fullNetworkName.substring(0, dot < 0 ? fullNetworkName.length : dot);
  }, [fullNetworkName]);

  const defaultRoughness = useMemo(
    () =>
      projectSettings.headlossFormula === "H-W"
        ? DEFAULT_ROUGHNESS_HW
        : DEFAULT_ROUGHNESS_DW_CM,
    [projectSettings.headlossFormula],
  );

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

  const handleSave = useCallback(async () => {
    const renames = pendingRenamesRef.current;
    if (renames.size > 0) {
      const moment = renameMaterialsMoment(hydraulicModel, renames);
      if (moment.patchAssetsAttributes!.length > 0) {
        transact(moment);
      }
      renames.clear();
    }

    await transactPipeLibrary(draftMaterials);
    userTracking.capture({
      name: "pipeLibrary.saved",
      materialsCount: draftMaterials.length,
    });
  }, [
    draftMaterials,
    transactPipeLibrary,
    hydraulicModel,
    transact,
    userTracking,
  ]);

  const handleAddMaterial = useCallback(
    (label: string) => {
      setDraftMaterials((prev) => [
        ...prev,
        { label, entries: [{ age: 0, roughness: defaultRoughness }] },
      ]);
      userTracking.capture({
        name: "pipeLibrary.material.changed",
        action: "added",
      });
    },
    [defaultRoughness, userTracking],
  );

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
      userTracking.capture({
        name: "pipeLibrary.material.changed",
        action: "renamed",
      });
    },
    [setSelectedLabel, userTracking],
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
      userTracking.capture({
        name: "pipeLibrary.material.changed",
        action: "duplicated",
      });
    },
    [userTracking],
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
      userTracking.capture({
        name: "pipeLibrary.material.changed",
        action: "deleted",
      });
    },
    [selectedLabel, setSelectedLabel, userTracking],
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
    if (moment.patchAssetsAttributes!.length === 0) {
      notify({
        id: "pipe-library-notification",
        variant: "default",
        title: translate("pipeLibrary.noAssetsChanged"),
      });
      return;
    }
    transact(moment);
    userTracking.capture({
      name: "pipeLibrary.roughnessApplied",
      pipesUpdated: moment.patchAssetsAttributes!.length,
    });
    notify({
      id: "pipe-library-notification",
      variant: "success",
      title: translate(
        "pipeLibrary.appliedRoughness",
        moment.patchAssetsAttributes!.length,
      ),
    });
  }, [hydraulicModel, draftMaterials, transact, translate, userTracking]);

  const handleImportFromModel = useCallback(() => {
    const detected = detectModelMaterials(hydraulicModel.assets);
    if (detected.length === 0) return;

    userTracking.capture({
      name: "pipeLibrary.importedFromModel",
      materialsDetected: detected.length,
    });

    setDraftMaterials((prev) => {
      const updated = [...prev];

      for (const det of detected) {
        const existingIndex = updated.findIndex((m) => m.label === det.label);

        if (existingIndex === -1) {
          const entries: RoughnessEntry[] = [
            { age: 0, roughness: defaultRoughness },
          ];
          for (const age of det.ages) {
            if (age !== 0) {
              entries.push({ age, roughness: defaultRoughness });
            }
          }
          entries.sort((a, b) => (a.age ?? 0) - (b.age ?? 0));
          updated.push({ label: det.label, entries });
        } else {
          const existing = updated[existingIndex];
          const existingAges = new Set(
            existing.entries
              .map((e) => e.age)
              .filter((a): a is number => a !== null),
          );
          const newEntries = [...existing.entries];
          for (const age of det.ages) {
            if (!existingAges.has(age)) {
              newEntries.push({ age, roughness: defaultRoughness });
            }
          }
          if (newEntries.length !== existing.entries.length) {
            newEntries.sort((a, b) => (a.age ?? 0) - (b.age ?? 0));
            updated[existingIndex] = { ...existing, entries: newEntries };
          }
        }
      }

      return updated;
    });
  }, [hydraulicModel, defaultRoughness, userTracking]);

  const handleExportXlsx = useCallback(async () => {
    await exportXlsx(draftMaterials, networkName);
    userTracking.capture({ name: "pipeLibrary.exported", format: "xlsx" });
  }, [draftMaterials, networkName, userTracking]);

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
          onClose={(hadChanges) =>
            userTracking.capture({ name: "pipeLibrary.closed", hadChanges })
          }
          saveDisabled={invalidMaterialLabels.size > 0}
        />
      }
    >
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <Button
            variant="default"
            size="sm"
            disabled={isEmpty || hasValidationErrors}
            onClick={handleApplyRoughness}
          >
            {translate("pipeLibrary.applyRoughness")}
          </Button>
          <div className="flex items-center gap-2">
            <ExportSubmenu handleExportXlsx={handleExportXlsx} />
            <Button variant="default" size="sm" onClick={handleImportFromModel}>
              {translate("pipeLibrary.importFromModel")}
            </Button>
          </div>
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

const ExportSubmenu = ({
  handleExportXlsx,
}: {
  handleExportXlsx: () => void;
}) => {
  const translate = useTranslate();
  const isExportOn = useFeatureFlag("FLAG_EXPORT_PIPE_LIBRARY");

  if (!isExportOn) return null;

  return (
    <DD.Root>
      <DD.Trigger asChild>
        <Button variant="default" size="sm">
          {translate("pipeLibrary.export")}
          <ChevronDownIcon />
        </Button>
      </DD.Trigger>
      <DDContent align="end">
        <StyledItem onSelect={handleExportXlsx}>
          {translate("pipeLibrary.exportXlsx")}
        </StyledItem>
      </DDContent>
    </DD.Root>
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
