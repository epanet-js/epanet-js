import { useState, useCallback, useMemo, useRef } from "react";
import { useAtomValue } from "jotai";
import { DialogContainer, DialogHeader, useDialogState } from "../../dialog";
import { useTranslate } from "src/hooks/use-translate";
import { Button } from "src/components/elements";
import { PatternSidebar } from "./pattern-sidebar";
import { PatternDetail } from "./pattern-detail";
import {
  PatternMultipliers,
  DemandPatterns,
  DemandPattern,
  PatternId,
  getNextPatternId,
} from "src/hydraulic-model/demands";
import { PatternsIcon } from "src/icons";
import { dataAtom } from "src/state/jotai";
import { usePersistence } from "src/lib/persistence/context";
import { changeDemandSettings } from "src/hydraulic-model/model-operations/change-demand-settings";
import { HydraulicModel } from "src/hydraulic-model/hydraulic-model";
import { Junction } from "src/hydraulic-model/asset-types/junction";
import { notify } from "src/components/notifications";

type PatternUpdate = Partial<Pick<DemandPattern, "label" | "multipliers">>;

export const CurvesAndPatternsDialog = () => {
  const translate = useTranslate();
  const { closeDialog } = useDialogState();
  const { hydraulicModel } = useAtomValue(dataAtom);
  const [selectedPatternId, setSelectedPatternId] = useState<PatternId | null>(
    null,
  );
  const [editedPatterns, setEditedPatterns] = useState<DemandPatterns>(
    () => new Map(hydraulicModel.demands.patterns),
  );
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const nextPatternIdRef = useRef<PatternId>(
    getNextPatternId(editedPatterns, editedPatterns.size),
  );
  nextPatternIdRef.current = getNextPatternId(
    editedPatterns,
    nextPatternIdRef.current,
  );

  const hasPatterns = editedPatterns.size > 0;
  const patternTimestepSeconds =
    hydraulicModel.epsTiming.patternTimestep ?? 3600;
  const totalDurationSeconds = hydraulicModel.epsTiming.duration ?? 0;

  const getPatternMultipliers = useCallback(
    (patternId: PatternId): PatternMultipliers =>
      editedPatterns.get(patternId)?.multipliers ?? [],
    [editedPatterns],
  );

  const handlePatternChange = useCallback(
    (patternId: PatternId, updates: PatternUpdate) => {
      setEditedPatterns((prev) => {
        const existing = prev.get(patternId);
        if (!existing) return prev;
        const next = new Map(prev);
        next.set(patternId, { ...existing, ...updates });
        return next;
      });
    },
    [],
  );

  const handleAddPattern = useCallback(
    (label: string, multipliers: PatternMultipliers): PatternId => {
      const id = nextPatternIdRef.current;
      setEditedPatterns((prev) => {
        const patterns = new Map(prev);
        patterns.set(id, { id, label, multipliers });
        return patterns;
      });
      return id;
    },
    [],
  );

  const handleDeletePattern = useCallback(
    (patternId: PatternId) => {
      if (isPatternInUse(hydraulicModel, patternId)) {
        notify({
          variant: "error",
          title: translate("deletePatternInUse"),
        });
        return;
      }

      setEditedPatterns((prev) => {
        const next = new Map(prev);
        next.delete(patternId);
        return next;
      });
      if (selectedPatternId === patternId) {
        setSelectedPatternId(null);
      }
    },
    [hydraulicModel, selectedPatternId, translate],
  );

  const rep = usePersistence();
  const transact = rep.useTransact();

  const hasChanges = useMemo(
    () => !arePatternsEqual(hydraulicModel.demands.patterns, editedPatterns),
    [hydraulicModel.demands.patterns, editedPatterns],
  );

  const handleSave = useCallback(() => {
    if (!hasChanges) {
      closeDialog();
      return;
    }

    const moment = changeDemandSettings(hydraulicModel, {
      patterns: editedPatterns,
    });
    transact(moment);

    closeDialog();
  }, [hasChanges, hydraulicModel, editedPatterns, transact, closeDialog]);

  const handleCancel = useCallback(() => {
    if (hasChanges) {
      setShowDiscardConfirm(true);
      return;
    }
    closeDialog();
  }, [hasChanges, closeDialog]);

  return (
    <DialogContainer size="lg" height="lg" onClose={handleCancel}>
      <DialogHeader title={translate("curvesAndPatterns")} />
      <div className="flex-1 flex min-h-0">
        <PatternSidebar
          patterns={editedPatterns}
          selectedPatternId={selectedPatternId}
          onSelectPattern={setSelectedPatternId}
          onAddPattern={handleAddPattern}
          onChangePattern={handlePatternChange}
          onDeletePattern={handleDeletePattern}
        />
        <div className="flex-1 flex flex-col min-h-0 w-full">
          {selectedPatternId ? (
            <PatternDetail
              key={selectedPatternId}
              pattern={getPatternMultipliers(selectedPatternId)}
              patternTimestepSeconds={patternTimestepSeconds}
              totalDurationSeconds={totalDurationSeconds}
              onChange={(multipliers) =>
                handlePatternChange(selectedPatternId, { multipliers })
              }
            />
          ) : hasPatterns ? (
            <div className="flex-1 flex items-center justify-center p-2 border-y border-r border-gray-200 dark:border-gray-700">
              <NoSelectionState />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-2 border-y border-r border-gray-200 dark:border-gray-700">
              <EmptyState />
            </div>
          )}
        </div>
      </div>
      <div className="pt-6 flex flex-row-reverse gap-x-3">
        {showDiscardConfirm ? (
          <>
            <Button type="button" variant="danger" onClick={closeDialog}>
              {translate("discardChanges")}
            </Button>
            <Button type="button" onClick={() => setShowDiscardConfirm(false)}>
              {translate("keepEditing")}
            </Button>
            <span className="text-sm text-gray-600 self-center">
              {translate("curvesAndPatternsUnsavedWarning")}
            </span>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="primary"
              onClick={handleSave}
              disabled={!hasChanges}
            >
              {translate("save")}
            </Button>
            <Button type="button" onClick={handleCancel}>
              {translate("cancel")}
            </Button>
          </>
        )}
      </div>
    </DialogContainer>
  );
};

const NoSelectionState = () => {
  const translate = useTranslate();

  return (
    <div className="flex flex-col items-center justify-center px-4">
      <div className="text-gray-400">
        <PatternsIcon size={96} />
      </div>
      <p className="text-sm text-gray-600 text-center max-w-64 py-4">
        {translate("curvesAndPatternsNoSelection")}
      </p>
    </div>
  );
};

const EmptyState = () => {
  const translate = useTranslate();

  return (
    <div className="flex flex-col items-center justify-center px-4">
      <div className="text-gray-400">
        <PatternsIcon size={96} />
      </div>
      <p className="text-sm font-semibold py-4 text-gray-600">
        {translate("curvesAndPatternsEmptyTitle")}
      </p>
      <p className="text-sm text-gray-600 text-center max-w-64">
        {translate("curvesAndPatternsEmptyDescription")}
      </p>
    </div>
  );
};

const isPatternInUse = (
  hydraulicModel: HydraulicModel,
  patternId: PatternId,
): boolean => {
  // Check customer points - only check the first one with demands
  for (const customerPoint of hydraulicModel.customerPoints.values()) {
    if (customerPoint.demands.length > 0) {
      for (const demand of customerPoint.demands) {
        if (demand.patternId === patternId) {
          return true;
        }
      }
      break;
    }
  }

  // Check junctions
  for (const asset of hydraulicModel.assets.values()) {
    if (asset.type === "junction") {
      const junction = asset as Junction;
      for (const demand of junction.demands) {
        if (demand.patternId === patternId) {
          return true;
        }
      }
    }
  }

  return false;
};

const arePatternsEqual = (
  original: DemandPatterns,
  edited: DemandPatterns,
): boolean => {
  if (original.size !== edited.size) return false;
  for (const [id, originalPattern] of original) {
    const editedPattern = edited.get(id);
    if (!editedPattern) return false;
    if (originalPattern.label !== editedPattern.label) return false;
    if (originalPattern.multipliers.length !== editedPattern.multipliers.length)
      return false;
    if (
      !originalPattern.multipliers.every(
        (val, idx) => val === editedPattern.multipliers[idx],
      )
    )
      return false;
  }
  return true;
};
