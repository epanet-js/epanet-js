import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useAtomValue } from "jotai";
import { BaseDialog } from "../../components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { PatternSidebar } from "./pattern-sidebar";
import { PatternDetail } from "./pattern-detail";
import { useIsSnapshotLocked } from "src/hooks/use-is-snapshot-locked";
import {
  PatternMultipliers,
  Patterns,
  Pattern,
  PatternId,
  PatternType,
  getNextPatternId,
  deepClonePatterns,
  differentPatternsCount,
} from "src/hydraulic-model";
import { PatternsIcon } from "src/icons";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { simulationSettingsAtom } from "src/state/simulation-settings";
import { usePersistence } from "src/lib/persistence";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useModelTransaction } from "src/hooks/use-model-transaction";
import { HydraulicModel } from "src/hydraulic-model/hydraulic-model";
import { Reservoir } from "src/hydraulic-model/asset-types/reservoir";
import { Pump } from "src/hydraulic-model/asset-types/pump";
import { notify } from "src/components/notifications";
import { useUserTracking } from "src/infra/user-tracking";
import { changePatterns } from "src/hydraulic-model/model-operations";
import { VerticalResizer } from "../vertical-resizer";
import { DialogActions, DialogActionsHandle } from "../dialog-actions-row";

type PatternUpdate = Partial<Pick<Pattern, "label" | "multipliers" | "type">>;

export const PatternsDialog = ({
  initialPatternId,
  initialSection,
}: {
  initialPatternId?: PatternId;
  initialSection?: PatternType;
}) => {
  const translate = useTranslate();
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const userTracking = useUserTracking();
  const isSnapshotLocked = useIsSnapshotLocked();
  const [selectedPatternId, setSelectedPatternId] = useState<PatternId | null>(
    initialPatternId ?? null,
  );
  const [editedPatterns, setEditedPatterns] = useState<Patterns>(() =>
    deepClonePatterns(hydraulicModel.patterns),
  );
  const [sidebarWidth, setSidebarWidth] = useState(224);
  const dialogActions = useRef<DialogActionsHandle>(null);
  const nextPatternIdRef = useRef<PatternId>(
    getNextPatternId(editedPatterns, editedPatterns.size),
  );
  nextPatternIdRef.current = getNextPatternId(
    editedPatterns,
    nextPatternIdRef.current,
  );

  const { timing, energyGlobalPatternId } = useAtomValue(
    simulationSettingsAtom,
  );
  const hasPatterns = editedPatterns.size > 0;
  const patternTimestepSeconds = timing.patternTimestep;
  const totalDurationSeconds = timing.duration;
  const minPatternSteps =
    totalDurationSeconds > 0
      ? Math.ceil(totalDurationSeconds / patternTimestepSeconds)
      : 1;

  useEffect(
    function trackUncategorizedPatterns() {
      const uncategorizedCount = [...hydraulicModel.patterns.values()].filter(
        (p) => !p.type,
      ).length;
      if (uncategorizedCount === 0) return;
      userTracking.capture({
        name: "patterns.uncategorized",
        count: uncategorizedCount,
      });
    },
    [hydraulicModel.patterns, userTracking],
  );

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
      const property =
        "label" in updates
          ? "label"
          : "type" in updates
            ? "type"
            : "multipliers";
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
    (patternId: PatternId, patternType?: PatternType) => {
      if (
        patternType &&
        isPatternInUse(
          hydraulicModel,
          patternId,
          patternType,
          energyGlobalPatternId,
        )
      ) {
        notify({
          variant: "error",
          title: translate("patterns.deletePatternInUse"),
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
    [
      hydraulicModel,
      selectedPatternId,
      translate,
      userTracking,
      energyGlobalPatternId,
    ],
  );

  const isStateRefactorOn = useFeatureFlag("FLAG_STATE_REFACTOR");
  const rep = usePersistence();
  const transactDeprecated = rep.useTransactDeprecated();
  const { transact: transactNew } = useModelTransaction();
  const transact = isStateRefactorOn ? transactNew : transactDeprecated;

  const unsavedChanges = useMemo(
    () => differentPatternsCount(hydraulicModel.patterns, editedPatterns),
    [hydraulicModel.patterns, editedPatterns],
  );

  const handleSave = useCallback(() => {
    const moment = changePatterns(hydraulicModel, editedPatterns);
    transact(moment);
    userTracking.capture({
      name: "patterns.updated",
      count: unsavedChanges,
    });
  }, [hydraulicModel, editedPatterns, transact, userTracking, unsavedChanges]);

  const handleClose = useCallback(
    (hasUnsavedChanges: boolean) => {
      if (hasUnsavedChanges)
        userTracking.capture({ name: "patterns.discarded" });
    },
    [userTracking],
  );

  return (
    <BaseDialog
      title={translate("patterns.title")}
      size="xl"
      height="xxl"
      isOpen={true}
      onClose={() => dialogActions.current?.closeDialog()}
      footer={
        <DialogActions
          ref={dialogActions}
          onSave={handleSave}
          onClose={handleClose}
          readOnly={isSnapshotLocked}
          hasChanges={!!unsavedChanges}
        />
      }
    >
      <div className="flex-1 flex min-h-0">
        <div className="flex-shrink-0 flex">
          <PatternSidebar
            width={sidebarWidth}
            patterns={editedPatterns}
            selectedPatternId={selectedPatternId}
            initialSection={initialSection}
            minPatternSteps={minPatternSteps}
            onSelectPattern={setSelectedPatternId}
            onAddPattern={handleAddPattern}
            onChangePattern={handlePatternChange}
            onDeletePattern={handleDeletePattern}
            readOnly={isSnapshotLocked}
          />
          <VerticalResizer
            width={sidebarWidth}
            onWidthChange={setSidebarWidth}
          />
        </div>
        <div className="flex-1 flex flex-col min-h-0 w-full ml-1">
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
            <div className="flex-1 flex items-center justify-center p-2">
              <NoSelectionState />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-2">
              <EmptyState readOnly={isSnapshotLocked} />
            </div>
          )}
        </div>
      </div>
    </BaseDialog>
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
        {translate("patterns.noSelection")}
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
        {translate("patterns.emptyTitle")}
      </p>
      {!readOnly && (
        <p className="text-sm text-gray-600 text-center max-w-64">
          {translate("patterns.emptyDescription")}
        </p>
      )}
    </div>
  );
};

const isPatternInUse = (
  hydraulicModel: HydraulicModel,
  patternId: PatternId,
  patternType: PatternType,
  energyGlobalPatternId?: PatternId | null,
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
    case "energyPrice":
      if (energyGlobalPatternId === patternId) {
        return true;
      }
      break;
    default:
      return false;
  }

  return false;
};
