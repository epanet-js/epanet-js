import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useAtomValue } from "jotai";
import { BaseDialog } from "../../components/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { CurveSidebar } from "./curve-sidebar";
import { CurveDetail } from "./curve-detail";
import { VerticalResizer } from "../vertical-resizer";
import { useIsSnapshotLocked } from "src/hooks/use-is-snapshot-locked";
import {
  Curves,
  ICurve,
  CurveId,
  CurvePoint,
  CurveType,
  buildDefaultCurve,
  stripTrailingEmptyPoints,
  deepCloneCurves,
  differentCurvesCount,
} from "src/hydraulic-model/curves";
import { CurveLibraryIcon } from "src/icons";
import { projectSettingsAtom } from "src/state/project-settings";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { usePersistence } from "src/lib/persistence";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useModelTransaction } from "src/hooks/use-model-transaction";
import { changeCurves } from "src/hydraulic-model/model-operations/change-curves";
import { notify } from "src/components/notifications";
import { useUserTracking } from "src/infra/user-tracking";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { getCurveTypeConfig } from "./curve-type-config";
import { HydraulicModel } from "src/hydraulic-model";
import { DialogActions, DialogActionsHandle } from "../dialog-actions-row";

type CurveUpdate = Partial<Pick<ICurve, "label" | "points" | "type">>;

const CURVE_LIBRARY_TYPES: Set<CurveType> = new Set([
  "volume",
  "valve",
  "headloss",
]);

export const CurveLibraryDialog = ({
  initialCurveId,
  initialSection,
}: {
  initialCurveId?: CurveId;
  initialSection?: "volume" | "valve" | "headloss";
}) => {
  const translate = useTranslate();
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const projectSettings = useAtomValue(projectSettingsAtom);
  const userTracking = useUserTracking();
  const isSnapshotLocked = useIsSnapshotLocked();
  const [selectedCurveId, setSelectedCurveId] = useState<CurveId | null>(
    initialCurveId ?? null,
  );
  const [editedCurves, setEditedCurves] = useState<Curves>(() =>
    deepCloneCurves(hydraulicModel.curves),
  );
  const [sidebarWidth, setSidebarWidth] = useState(224);
  const labelManagerRef = useRef<LabelManager>(
    createLabelManager(editedCurves),
  );
  const dialogActions = useRef<DialogActionsHandle>(null);

  const hasCurves = editedCurves.size > 0;

  useEffect(
    function trackUncategorizedCurves() {
      const uncategorizedCount = [...hydraulicModel.curves.values()].filter(
        (c) => !c.type,
      ).length;
      if (uncategorizedCount === 0) return;
      userTracking.capture({
        name: "curves.uncategorized",
        count: uncategorizedCount,
      });
    },
    [hydraulicModel.curves, userTracking],
  );

  const getCurvePoints = useCallback(
    (curveId: CurveId): CurvePoint[] => editedCurves.get(curveId)?.points ?? [],
    [editedCurves],
  );

  const handleCurveChange = useCallback(
    (curveId: CurveId, updates: CurveUpdate) => {
      setEditedCurves((prev) => {
        const existing = prev.get(curveId);
        if (!existing) return prev;
        const next = new Map(prev);

        if (
          "label" in updates &&
          updates.label &&
          updates.label !== existing.label
        ) {
          labelManagerRef.current.remove(existing.label, "curve", curveId);
          labelManagerRef.current.register(updates.label, "curve", curveId);
        }

        next.set(curveId, { ...existing, ...updates });
        return next;
      });

      const property =
        "label" in updates ? "label" : "type" in updates ? "type" : "points";
      userTracking.capture({ name: "curve.changed", property });
    },
    [userTracking],
  );

  const handleAddCurve = useCallback(
    (
      label: string,
      points: CurvePoint[],
      source: "new" | "clone",
      type: CurveType,
    ): CurveId => {
      const newCurve = buildDefaultCurve(
        editedCurves,
        labelManagerRef.current,
        label,
        type,
      );
      newCurve.points = points;
      setEditedCurves((prev) => {
        const next = new Map(prev);
        next.set(newCurve.id, newCurve);
        return next;
      });
      labelManagerRef.current.register(newCurve.label, "curve", newCurve.id);

      userTracking.capture({ name: "curve.added", source });
      return newCurve.id;
    },
    [editedCurves, userTracking],
  );

  const handleDeleteCurve = useCallback(
    (curveId: CurveId) => {
      const curve = editedCurves.get(curveId);
      if (!curve) return;

      if (isCurveInUse(hydraulicModel, curve)) {
        notify({
          variant: "error",
          title: translate("curves.deleteCurveInUse"),
        });
        return;
      }

      setEditedCurves((prev) => {
        const next = new Map(prev);
        next.delete(curveId);
        return next;
      });
      labelManagerRef.current.remove(curve.label, "curve", curveId);
      if (selectedCurveId === curveId) {
        setSelectedCurveId(null);
      }
      userTracking.capture({ name: "curve.deleted" });
    },
    [hydraulicModel, editedCurves, selectedCurveId, translate, userTracking],
  );

  const isStateRefactorOn = useFeatureFlag("FLAG_STATE_REFACTOR");
  const rep = usePersistence();
  const transactDeprecated = rep.useTransactDeprecated();
  const { transact: transactNew } = useModelTransaction();
  const transact = isStateRefactorOn ? transactNew : transactDeprecated;

  const cleanedCurves = useMemo(() => {
    const cleaned: Curves = new Map();
    for (const [id, curve] of editedCurves) {
      cleaned.set(id, {
        ...curve,
        points: stripTrailingEmptyPoints(curve.points),
      });
    }
    return cleaned;
  }, [editedCurves]);

  const unsavedChanges = useMemo(
    () => differentCurvesCount(hydraulicModel.curves, cleanedCurves),
    [hydraulicModel.curves, cleanedCurves],
  );

  const invalidCurveIds = useMemo(() => {
    const ids = new Set<CurveId>();
    for (const [id, curve] of cleanedCurves) {
      const config = getCurveTypeConfig(curve.type);
      if (config.getErrors(curve.points).length > 0) {
        ids.add(id);
      }
    }
    return ids;
  }, [cleanedCurves]);

  const handleSave = useCallback(
    (hasWarnings: boolean) => {
      const moment = changeCurves(hydraulicModel, {
        curves: cleanedCurves,
      });
      transact(moment);
      userTracking.capture({
        name: "curves.updated",
        count: cleanedCurves.size,
        withWarnings: hasWarnings,
      });
    },
    [hydraulicModel, cleanedCurves, transact, userTracking],
  );

  const handleClose = useCallback(
    (hasUnsavedChanges: boolean) => {
      if (hasUnsavedChanges) userTracking.capture({ name: "curves.discarded" });
    },
    [userTracking],
  );

  return (
    <BaseDialog
      title={translate("curves.title")}
      size="lg"
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
          hasWarnings={invalidCurveIds.size > 0}
        />
      }
    >
      <div className="flex-1 flex min-h-0">
        <div className="flex-shrink-0 flex">
          <CurveSidebar
            width={sidebarWidth}
            curves={editedCurves}
            selectedCurveId={selectedCurveId}
            initialSection={initialSection}
            labelManager={labelManagerRef.current}
            invalidCurveIds={invalidCurveIds}
            onSelectCurve={setSelectedCurveId}
            onAddCurve={handleAddCurve}
            onChangeCurve={handleCurveChange}
            onDeleteCurve={handleDeleteCurve}
            readOnly={isSnapshotLocked}
          />
          <VerticalResizer
            width={sidebarWidth}
            onWidthChange={setSidebarWidth}
          />
        </div>
        <div className="flex-1 flex flex-col min-h-0 w-full">
          {selectedCurveId ? (
            (() => {
              const curveType = editedCurves.get(selectedCurveId)?.type;
              const isUncategorized =
                !curveType || !CURVE_LIBRARY_TYPES.has(curveType);
              return (
                <CurveDetail
                  points={getCurvePoints(selectedCurveId)}
                  onChange={(points) =>
                    handleCurveChange(selectedCurveId, { points })
                  }
                  readOnly={isSnapshotLocked || isUncategorized}
                  curveType={curveType}
                  units={projectSettings.units}
                />
              );
            })()
          ) : hasCurves ? (
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
        <CurveLibraryIcon size={96} />
      </div>
      <p className="text-sm text-gray-600 text-center max-w-64 py-4">
        {translate("curves.noSelection")}
      </p>
    </div>
  );
};

const EmptyState = ({ readOnly }: { readOnly: boolean }) => {
  const translate = useTranslate();

  return (
    <div className="flex flex-col items-center justify-center px-4">
      <div className="text-gray-400">
        <CurveLibraryIcon size={96} />
      </div>
      <p className="text-sm font-semibold py-4 text-gray-600">
        {translate("curves.emptyTitle")}
      </p>
      {!readOnly && (
        <p className="text-sm text-gray-600 text-center max-w-64">
          {translate("curves.emptyDescription")}
        </p>
      )}
    </div>
  );
};

const createLabelManager = (curves: Curves): LabelManager => {
  const lm = new LabelManager();
  for (const curve of curves.values()) {
    lm.register(curve.label, "curve", curve.id);
  }
  return lm;
};

const isCurveInUse = (
  _hydraulicModel: HydraulicModel,
  _curve: Pick<ICurve, "id" | "type">,
): boolean => {
  return false;
};
