import { useState, useCallback, useRef, useMemo } from "react";
import { useAtom, useAtomValue } from "jotai";
import { TranslateFn, useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
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
  detectModelMaterials,
  renameMaterialsMoment,
  validateMaterial,
  exportCsv,
  exportXlsx,
  importFromFile,
  ImportPipeLibraryResult,
} from "src/lib/pipe-library";
import {
  DEFAULT_ROUGHNESS_HW,
  DEFAULT_ROUGHNESS_DW_CM,
} from "@epanet-js/pipe-library";
import type { PipeMaterial, RoughnessEntry } from "@epanet-js/pipe-library";

export const usePipeLibraryHandlers = () => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const projectSettings = useAtomValue(projectSettingsAtom);
  const { transact } = useMomentTransaction();
  const savedMaterials = useAtomValue(pipeMaterialsAtom);
  const { transact: transactPipeLibrary } = usePipeLibraryTransaction();
  const [selectedLabel, setSelectedLabel] = useAtom(selectedMaterialLabelAtom);
  const [draftMaterials, setDraftMaterials] =
    useState<PipeMaterial[]>(savedMaterials);
  const [sidebarWidth, setSidebarWidth] = useState(224);
  const [pendingImport, setPendingImport] = useState<"file" | "model" | null>(
    null,
  );
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

  const handleImportFromFile = useCallback(async () => {
    const result = await importFromFile();
    if (!result) return;

    if (result.status === "success" && result.pipeLibrary) {
      setDraftMaterials(result.pipeLibrary);
      setSelectedLabel(null);
      pendingRenamesRef.current.clear();
      userTracking.capture({
        name: "pipeLibrary.importedFromFile",
        materialsCount: result.pipeLibrary.length,
        format: result.format,
      });
      notify({
        id: "pipe-library-notification",
        variant: "success",
        title: translate(
          "pipeLibrary.import.success",
          result.pipeLibrary.length,
        ),
      });
    } else {
      notify({
        id: "pipe-library-notification",
        variant: "error",
        title: translate("pipeLibrary.import.errorTitle"),
        description: translate("pipeLibrary.import.errorDescription"),
        details: formatErrors(result, translate),
        duration: 10000,
      });
    }
  }, [setSelectedLabel, translate, userTracking]);

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

  const requestImportFromFile = useCallback(() => {
    if (draftMaterials.length > 0) {
      setPendingImport("file");
    } else {
      void handleImportFromFile();
    }
  }, [draftMaterials.length, handleImportFromFile]);

  const requestImportFromModel = useCallback(() => {
    if (draftMaterials.length > 0) {
      setPendingImport("model");
    } else {
      handleImportFromModel();
    }
  }, [draftMaterials.length, handleImportFromModel]);

  const handleAcceptImport = useCallback(() => {
    setPendingImport(null);
    if (pendingImport === "file") void handleImportFromFile();
    else handleImportFromModel();
  }, [handleImportFromFile, handleImportFromModel, pendingImport]);

  const handleCancelImport = useCallback(() => {
    setPendingImport(null);
  }, []);

  const handleExportCsv = useCallback(async () => {
    await exportCsv(draftMaterials, networkName);
    userTracking.capture({ name: "pipeLibrary.exported", format: "csv" });
  }, [draftMaterials, networkName, userTracking]);

  const handleExportXlsx = useCallback(async () => {
    await exportXlsx(draftMaterials, networkName);
    userTracking.capture({ name: "pipeLibrary.exported", format: "xlsx" });
  }, [draftMaterials, networkName, userTracking]);

  const handleClose = useCallback(
    (hadChanges: boolean) => {
      userTracking.capture({ name: "pipeLibrary.closed", hadChanges });
    },
    [userTracking],
  );

  return {
    translate,
    draftMaterials,
    selectedLabel,
    setSelectedLabel,
    selectedMaterial,
    isEmpty,
    hasChanges,
    invalidMaterialLabels,
    hasValidationErrors,
    sidebarWidth,
    setSidebarWidth,
    pendingImport,
    handleSave,
    handleApplyRoughness,
    handleAddMaterial,
    handleRenameMaterial,
    handleDuplicateMaterial,
    handleDeleteMaterial,
    handleEntriesChange,
    handleExportCsv,
    handleExportXlsx,
    requestImportFromFile,
    requestImportFromModel,
    handleAcceptImport,
    handleCancelImport,
    handleClose,
  };
};

const formatErrors = (
  result: ImportPipeLibraryResult,
  translate: TranslateFn,
) =>
  result.errors
    .map(
      (e) =>
        `· ${e.material ? e.material + ": " : ""}${translate(e.message, e.value ?? "")}`,
    )
    .join("\n");
