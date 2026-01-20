import { useState, useCallback, useMemo } from "react";
import { useAtomValue } from "jotai";
import { DialogContainer, DialogHeader, useDialogState } from "../../dialog";
import { useTranslate } from "src/hooks/use-translate";
import { Button } from "src/components/elements";
import { PatternSidebar } from "./pattern-sidebar";
import { PatternTable } from "./pattern-table";
import { PatternGraph } from "./pattern-graph";
import { DemandPattern, PatternId } from "src/hydraulic-model/demands";
import { PatternsIcon } from "src/icons";
import { dataAtom } from "src/state/jotai";
import { usePersistence } from "src/lib/persistence/context";
import { changeDemandSettings } from "src/hydraulic-model/model-operations/change-demand-settings";

const arePatternsEqual = (
  original: Map<PatternId, DemandPattern>,
  edited: Map<PatternId, DemandPattern>,
): boolean => {
  if (original.size !== edited.size) return false;
  for (const [patternId, originalPattern] of original) {
    const editedPattern = edited.get(patternId);
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
  const [selectedPatternId, setSelectedPatternId] = useState<PatternId | null>(
    null,
  );
  const [editedPatterns, setEditedPatterns] = useState<
    Map<PatternId, DemandPattern>
  >(() => new Map(hydraulicModel.demands.patterns));
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const hasPatterns = editedPatterns.size > 0;
  const patternTimestepSeconds =
    hydraulicModel.epsTiming.patternTimestep ?? 3600;
  const totalDurationSeconds = hydraulicModel.epsTiming.duration;

  const getPatternData = useCallback(
    (patternId: PatternId): DemandPattern =>
      editedPatterns.get(patternId) ?? [],
    [editedPatterns],
  );

  const handlePatternChange = useCallback(
    (patternId: PatternId, newPattern: DemandPattern) => {
      setEditedPatterns((prev) => new Map(prev).set(patternId, newPattern));
    },
    [],
  );

  const handleAddPattern = useCallback(
    (patternId: PatternId, pattern: DemandPattern) => {
      setEditedPatterns((prev) => {
        const next = new Map(prev);
        next.set(patternId, pattern);
        return next;
      });
    },
    [],
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
        />
        <div className="flex-1 flex flex-col min-h-0 p-2 w-full">
          {selectedPatternId ? (
            <div className="grid grid-cols-2 gap-4 h-full">
              <div className="h-full overflow-hidden">
                <PatternTable
                  pattern={getPatternData(selectedPatternId)}
                  patternTimestepSeconds={patternTimestepSeconds}
                  onChange={(newPattern) =>
                    handlePatternChange(selectedPatternId, newPattern)
                  }
                />
              </div>
              <div className="h-full pt-4">
                <PatternGraph
                  pattern={getPatternData(selectedPatternId)}
                  intervalSeconds={patternTimestepSeconds}
                  totalDurationSeconds={totalDurationSeconds}
                />
              </div>
            </div>
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
            <span className="flex-1 text-sm text-gray-600 self-center">
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
