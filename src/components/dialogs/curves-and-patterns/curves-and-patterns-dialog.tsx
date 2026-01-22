import { useState, useCallback, useMemo } from "react";
import { useAtomValue } from "jotai";
import { DialogContainer, DialogHeader, useDialogState } from "../../dialog";
import { useTranslate } from "src/hooks/use-translate";
import { Button } from "src/components/elements";
import { PatternSidebar } from "./pattern-sidebar";
import { PatternDetail } from "./pattern-detail";
import { PatternMultipliers, PatternLabel } from "src/hydraulic-model/demands";
import { PatternsIcon } from "src/icons";
import { dataAtom } from "src/state/jotai";
import { usePersistence } from "src/lib/persistence/context";
import { changeDemandSettings } from "src/hydraulic-model/model-operations/change-demand-settings";

const arePatternsEqual = (
  original: Map<PatternLabel, PatternMultipliers>,
  edited: Map<PatternLabel, PatternMultipliers>,
): boolean => {
  if (original.size !== edited.size) return false;
  for (const [patternLabel, originalPattern] of original) {
    const editedPattern = edited.get(patternLabel);
    if (!editedPattern) return false;
    if (originalPattern.length !== editedPattern.length) return false;
    if (!originalPattern.every((val, idx) => val === editedPattern[idx]))
      return false;
  }
  return true;
};

export const CurvesAndPatternsDialog = () => {
  const translate = useTranslate();
  const { closeDialog } = useDialogState();
  const { hydraulicModel } = useAtomValue(dataAtom);
  const [selectedPatternLabel, setSelectedPatternLabel] =
    useState<PatternLabel | null>(null);
  const [editedPatterns, setEditedPatterns] = useState<
    Map<PatternLabel, PatternMultipliers>
  >(() => new Map(hydraulicModel.demands.patternsLegacy));
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const hasPatterns = editedPatterns.size > 0;
  const patternTimestepSeconds =
    hydraulicModel.epsTiming.patternTimestep ?? 3600;
  const totalDurationSeconds = hydraulicModel.epsTiming.duration ?? 0;

  const getPatternData = useCallback(
    (patternLabel: PatternLabel): PatternMultipliers =>
      editedPatterns.get(patternLabel) ?? [],
    [editedPatterns],
  );

  const handlePatternChange = useCallback(
    (patternLabel: PatternLabel, newPattern: PatternMultipliers) => {
      setEditedPatterns((prev) => new Map(prev).set(patternLabel, newPattern));
    },
    [],
  );

  const handleAddPattern = useCallback(
    (patternLabel: PatternLabel, pattern: PatternMultipliers) => {
      setEditedPatterns((prev) => {
        const next = new Map(prev);
        next.set(patternLabel, pattern);
        return next;
      });
    },
    [],
  );

  const rep = usePersistence();
  const transact = rep.useTransact();

  const hasChanges = useMemo(
    () =>
      !arePatternsEqual(hydraulicModel.demands.patternsLegacy, editedPatterns),
    [hydraulicModel.demands.patternsLegacy, editedPatterns],
  );

  const handleSave = useCallback(() => {
    if (!hasChanges) {
      closeDialog();
      return;
    }

    const moment = changeDemandSettings(hydraulicModel, {
      patternsLegacy: editedPatterns,
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
          selectedPatternLabel={selectedPatternLabel}
          onSelectPattern={setSelectedPatternLabel}
          onAddPattern={handleAddPattern}
        />
        <div className="flex-1 flex flex-col min-h-0 p-2 w-full">
          {selectedPatternLabel ? (
            <PatternDetail
              key={selectedPatternLabel}
              pattern={getPatternData(selectedPatternLabel)}
              patternTimestepSeconds={patternTimestepSeconds}
              totalDurationSeconds={totalDurationSeconds}
              onChange={(newPattern) =>
                handlePatternChange(selectedPatternLabel, newPattern)
              }
            />
          ) : hasPatterns ? (
            <div className="flex-1 flex items-center justify-center">
              <NoSelectionState />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
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
