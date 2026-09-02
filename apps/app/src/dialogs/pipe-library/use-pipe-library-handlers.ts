import { useState, useCallback, useRef, useMemo } from "react";
import { useAtom, useAtomValue } from "jotai";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { projectSettingsAtom } from "src/state/project-settings";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { selectedMaterialLabelAtom } from "src/state/pipe-library";
import { changeProperty } from "src/hydraulic-model/model-operations/change-property";
import { changePipeMaterials } from "src/hydraulic-model/model-operations";
import { renameAssignments } from "./rename-materials";
import {
  detectModelMaterials,
  validateMaterial,
  type ImportPipeLibraryResult,
} from "src/hydraulic-model/pipe-materials";
import { groupErrors, type ImportOutcome } from "src/components/import-outcome";
import { useExportPipeLibrary } from "src/commands/export-pipe-library";
import { useImportPipeLibrary } from "src/commands/import-pipe-library";
import {
  DEFAULT_ROUGHNESS_HW,
  DEFAULT_ROUGHNESS_DW_CM,
} from "@epanet-js/hydraulic-model";
import type { PipeMaterial, RoughnessEntry } from "@epanet-js/hydraulic-model";

export const usePipeLibraryHandlers = () => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const projectSettings = useAtomValue(projectSettingsAtom);
  const { transact } = useMomentTransaction();
  const savedMaterials = hydraulicModel.pipeMaterials;
  const [selectedLabel, setSelectedLabel] = useAtom(selectedMaterialLabelAtom);
  const [draftMaterials, setDraftMaterials] =
    useState<PipeMaterial[]>(savedMaterials);
  const [sidebarWidth, setSidebarWidth] = useState(224);
  const [pendingImport, setPendingImport] = useState<"file" | "model" | null>(
    null,
  );
  const [importOutcome, setImportOutcome] = useState<ImportOutcome | null>(
    null,
  );
  const pendingRenamesRef = useRef(new Map<string, string>());

  const { exportToCsv, exportToXlsx } = useExportPipeLibrary();
  const importPipeLibraryFromFile = useImportPipeLibrary();

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

  const handleSave = useCallback(() => {
    const renames = pendingRenamesRef.current;
    const renamePatches =
      renames.size > 0
        ? renameAssignments(hydraulicModel, renames).flatMap(
            ({ assetIds, material }) =>
              changeProperty(hydraulicModel, {
                assetIds,
                property: "material",
                value: material,
              }).patchAssetsAttributes!,
          )
        : [];
    renames.clear();

    const moment = changePipeMaterials(hydraulicModel, draftMaterials);
    if (renamePatches.length > 0) {
      moment.patchAssetsAttributes = renamePatches;
    }
    transact(moment);

    userTracking.capture({
      name: "pipeLibrary.saved",
      materialsCount: draftMaterials.length,
    });
  }, [draftMaterials, hydraulicModel, transact, userTracking]);

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

  const reportImport = useCallback(
    (result: ImportPipeLibraryResult) => {
      const message = (() => {
        if (result.status === "error") {
          return translate("pipeLibrary.import.errorTitle");
        }

        const numMaterials = result.pipeLibrary?.length ?? 0;

        if (numMaterials === 0) {
          return translate("pipeLibrary.import.noMaterialsImported");
        }

        if (result.status === "partial") {
          return translate("pipeLibrary.import.partialTitle", numMaterials);
        }

        return translate("pipeLibrary.import.success", numMaterials);
      })();

      const status = (() => {
        if (result.status === "partial") return "warning" as const;
        if (result.status === "error") return "failed" as const;
        if (result.pipeLibrary?.length === 0) return "info" as const;
        return "success" as const;
      })();

      setImportOutcome({ status, message, issues: groupErrors(result.errors) });
      setSelectedLabel(null);
    },
    [translate, setSelectedLabel],
  );

  const handleImportFromFile = useCallback(async () => {
    const result = await importPipeLibraryFromFile();
    if (!result) return;

    if (result.pipeLibrary) {
      setDraftMaterials(result.pipeLibrary);
      pendingRenamesRef.current.clear();
    }

    reportImport(result);
  }, [importPipeLibraryFromFile, reportImport]);

  const handleImportFromModel = useCallback(() => {
    const result = detectModelMaterials(
      hydraulicModel.assets,
      defaultRoughness,
    );

    if (!result.pipeLibrary || result.pipeLibrary.length === 0) {
      reportImport(result);
      return;
    }

    setDraftMaterials(result.pipeLibrary);
    pendingRenamesRef.current.clear();

    userTracking.capture({
      name: "pipeLibrary.importedFromModel",
      materialsDetected: result.pipeLibrary.length,
    });

    reportImport(result);
  }, [hydraulicModel, defaultRoughness, reportImport, userTracking]);

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

  const handleDismissImportOutcome = useCallback(() => {
    setImportOutcome(null);
  }, []);

  const handleSelectMaterial = useCallback(
    (label: string | null) => {
      setSelectedLabel(label);
      setImportOutcome(null);
    },
    [setSelectedLabel],
  );

  const handleExportCsv = useCallback(async () => {
    await exportToCsv(draftMaterials);
  }, [draftMaterials, exportToCsv]);

  const handleExportXlsx = useCallback(async () => {
    await exportToXlsx(draftMaterials);
  }, [draftMaterials, exportToXlsx]);

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
    handleSelectMaterial,
    selectedMaterial,
    isEmpty,
    hasChanges,
    invalidMaterialLabels,
    sidebarWidth,
    setSidebarWidth,
    pendingImport,
    handleSave,
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
    importOutcome,
    handleDismissImportOutcome,
  };
};
