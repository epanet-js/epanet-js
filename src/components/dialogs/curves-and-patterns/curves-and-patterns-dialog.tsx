import { useState, useCallback, useMemo, useRef } from "react";
import { useAtomValue } from "jotai";
import { DialogContainer, DialogHeader, useDialogState } from "../../dialog";
import { useTranslate } from "src/hooks/use-translate";
import { Button } from "src/components/elements";
import { PatternSidebar } from "./pattern-sidebar";
import { GroupedPatternSidebar } from "./grouped-pattern-sidebar";
import { PatternDetail } from "./pattern-detail";
import { useIsSnapshotLocked } from "src/hooks/use-is-snapshot-locked";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import {
  PatternMultipliers,
  Patterns,
  Pattern,
  PatternId,
  PatternType,
  getNextPatternId,
} from "src/hydraulic-model";
import { PatternsIcon } from "src/icons";
import { stagingModelAtom } from "src/state/jotai";
import { usePersistence } from "src/lib/persistence";
import { HydraulicModel } from "src/hydraulic-model/hydraulic-model";
import { Reservoir } from "src/hydraulic-model/asset-types/reservoir";
import { Pump } from "src/hydraulic-model/asset-types/pump";
import { notify } from "src/components/notifications";
import { useUserTracking } from "src/infra/user-tracking";
import { changePatterns } from "src/hydraulic-model/model-operations";

type PatternUpdate = Partial<Pick<Pattern, "label" | "multipliers">>;

export const CurvesAndPatternsDialog = ({
  initialPatternId,
}: {
  initialPatternId?: PatternId;
}) => {
  const translate = useTranslate();
  const { closeDialog } = useDialogState();
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const userTracking = useUserTracking();
  const isSnapshotLocked = useIsSnapshotLocked();
  const isMorePatternsOn = useFeatureFlag("FLAG_MORE_PATTERNS");
  const [selectedPatternId, setSelectedPatternId] = useState<PatternId | null>(
    initialPatternId ?? null,
  );
  const [editedPatterns, setEditedPatterns] = useState<Patterns>(
    () => new Map(hydraulicModel.patterns),
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
  const minPatternSteps =
    totalDurationSeconds > 0
      ? Math.ceil(totalDurationSeconds / patternTimestepSeconds)
      : 1;

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
      const property = "label" in updates ? "label" : "multipliers";
      userTracking.capture({ name: "pattern.changed", property });
    },
    [userTracking],
  );

  const handleAddPattern = useCallback(
    (
      label: string,
      multipliers: PatternMultipliers,
      source: "new" | "clone",
      type: PatternType = "demand",
    ): PatternId => {
      const id = nextPatternIdRef.current;
      setEditedPatterns((prev) => {
        const patterns = new Map(prev);
        patterns.set(id, { id, label, multipliers, type });
        return patterns;
      });
      userTracking.capture({ name: "pattern.added", source });
      return id;
    },
    [userTracking],
  );

  const handleDeletePattern = useCallback(
    (patternId: PatternId, patternType: PatternType) => {
      if (isPatternInUse(hydraulicModel, patternId, patternType)) {
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
      userTracking.capture({ name: "pattern.deleted" });
    },
    [hydraulicModel, selectedPatternId, translate, userTracking],
  );

  const rep = usePersistence();
  const transact = rep.useTransact();

  const hasChanges = useMemo(
    () => !arePatternsEqual(hydraulicModel.patterns, editedPatterns),
    [hydraulicModel.patterns, editedPatterns],
  );

  const handleSave = useCallback(() => {
    if (!hasChanges) {
      closeDialog();
      return;
    }

    const moment = changePatterns(hydraulicModel, editedPatterns);
    transact(moment);
    userTracking.capture({
      name: "patterns.updated",
      count: editedPatterns.size,
    });

    closeDialog();
  }, [
    hasChanges,
    hydraulicModel,
    editedPatterns,
    transact,
    closeDialog,
    userTracking,
  ]);

  const handleCancel = useCallback(() => {
    if (hasChanges) {
      setShowDiscardConfirm(true);
      return;
    }
    closeDialog();
  }, [hasChanges, closeDialog]);

  const handleDiscard = useCallback(() => {
    userTracking.capture({ name: "patterns.discarded" });
    closeDialog();
  }, [userTracking, closeDialog]);

  return (
    <DialogContainer size="lg" height="lg" onClose={handleCancel}>
      <DialogHeader title={translate("curvesAndPatterns")} />
      <div className="flex-1 flex min-h-0 gap-4">
        {isMorePatternsOn ? (
          <GroupedPatternSidebar
            patterns={editedPatterns}
            selectedPatternId={selectedPatternId}
            minPatternSteps={minPatternSteps}
            onSelectPattern={setSelectedPatternId}
            onAddPattern={handleAddPattern}
            onChangePattern={handlePatternChange}
            onDeletePattern={handleDeletePattern}
            readOnly={isSnapshotLocked}
          />
        ) : (
          <PatternSidebar
            patterns={editedPatterns}
            selectedPatternId={selectedPatternId}
            minPatternSteps={minPatternSteps}
            onSelectPattern={setSelectedPatternId}
            onAddPattern={handleAddPattern}
            onChangePattern={handlePatternChange}
            onDeletePattern={handleDeletePattern}
            readOnly={isSnapshotLocked}
          />
        )}
        <div className="flex-1 flex flex-col min-h-0 w-full">
          {selectedPatternId ? (
            <PatternDetail
              pattern={getPatternMultipliers(selectedPatternId)}
              patternType={editedPatterns.get(selectedPatternId)?.type}
              patternTimestepSeconds={patternTimestepSeconds}
              totalDurationSeconds={totalDurationSeconds}
              onChange={(multipliers) =>
                handlePatternChange(selectedPatternId, { multipliers })
              }
              readOnly={isSnapshotLocked}
            />
          ) : hasPatterns ? (
            <div className="flex-1 flex items-center justify-center p-2 border border-gray-200 dark:border-gray-700">
              <NoSelectionState />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-2 border border-gray-200 dark:border-gray-700">
              <EmptyState readOnly={isSnapshotLocked} />
            </div>
          )}
        </div>
      </div>
      <div className="pt-6 flex flex-row-reverse gap-x-3">
        {isSnapshotLocked ? (
          <Button type="button" onClick={closeDialog}>
            {translate("close")}
          </Button>
        ) : showDiscardConfirm ? (
          <>
            <Button type="button" variant="danger" onClick={handleDiscard}>
              {translate("discardChanges")}
            </Button>
            <Button type="button" onClick={() => setShowDiscardConfirm(false)}>
              {translate("keepEditing")}
            </Button>
            <span className="text-sm text-gray-600 self-center">
              {translate("discardUnsavedChangesWarning")}
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

const EmptyState = ({ readOnly }: { readOnly: boolean }) => {
  const translate = useTranslate();

  return (
    <div className="flex flex-col items-center justify-center px-4">
      <div className="text-gray-400">
        <PatternsIcon size={96} />
      </div>
      <p className="text-sm font-semibold py-4 text-gray-600">
        {translate("curvesAndPatternsEmptyTitle")}
      </p>
      {!readOnly && (
        <p className="text-sm text-gray-600 text-center max-w-64">
          {translate("curvesAndPatternsEmptyDescription")}
        </p>
      )}
    </div>
  );
};

const isPatternInUse = (
  hydraulicModel: HydraulicModel,
  patternId: PatternId,
  patternType: PatternType,
): boolean => {
  switch (patternType) {
    case "demand":
      // Check customer points — all CPs share the same pattern, so only check the first one with demands
      for (const demands of hydraulicModel.demands.customerPoints.values()) {
        if (demands.length > 0) {
          return demands.some((demand) => demand.patternId === patternId);
        }
      }

      // Check junctions
      for (const demands of hydraulicModel.demands.junctions.values()) {
        for (const demand of demands) {
          if (demand.patternId === patternId) {
            return true;
          }
        }
      }
      break;
    case "reservoirHead":
      for (const asset of hydraulicModel.assets.values()) {
        if (asset instanceof Reservoir && asset.headPatternId === patternId) {
          return true;
        }
      }
      break;
    case "pumpSpeed":
      for (const asset of hydraulicModel.assets.values()) {
        if (asset instanceof Pump && asset.speedPatternId === patternId) {
          return true;
        }
      }
      break;
    default:
      return false;
  }

  return false;
};

const arePatternsEqual = (original: Patterns, edited: Patterns): boolean => {
  if (original.size !== edited.size) return false;
  for (const [id, originalPattern] of original) {
    const editedPattern = edited.get(id);
    if (!editedPattern) return false;
    if (originalPattern.label !== editedPattern.label) return false;
    if (originalPattern.type !== editedPattern.type) return false;
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
