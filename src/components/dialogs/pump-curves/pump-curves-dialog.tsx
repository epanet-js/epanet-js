import { useState, useCallback, useMemo, useRef } from "react";
import { useAtomValue } from "jotai";
import { DialogContainer, DialogHeader, useDialogState } from "../../dialog";
import { useTranslate } from "src/hooks/use-translate";
import { Button } from "src/components/elements";
import { CurveSidebar } from "./curve-sidebar";
import { CurveDetail } from "./curve-detail";
import { useIsSnapshotLocked } from "src/hooks/use-is-snapshot-locked";
import {
  Curves,
  ICurve,
  CurveId,
  CurvePoint,
  buildDefaultPumpCurve,
} from "src/hydraulic-model/curves";
import { PumpCurvesIcon } from "src/icons";
import { stagingModelAtom } from "src/state/jotai";
import { usePersistence } from "src/lib/persistence";
import { changeCurves } from "src/hydraulic-model/model-operations/change-curves";
import { notify } from "src/components/notifications";
import { useUserTracking } from "src/infra/user-tracking";
import { LabelManager } from "src/hydraulic-model/label-manager";

type CurveUpdate = Partial<Pick<ICurve, "label" | "points">>;

export const PumpCurvesDialog = () => {
  const translate = useTranslate();
  const { closeDialog } = useDialogState();
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const userTracking = useUserTracking();
  const isSnapshotLocked = useIsSnapshotLocked();
  const [selectedCurveId, setSelectedCurveId] = useState<CurveId | null>(null);
  const [editedCurves, setEditedCurves] = useState<Curves>(() =>
    deepCloneCurves(hydraulicModel.curves),
  );
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const labelManagerRef = useRef<LabelManager>(
    createLabelManagerFromCurves(editedCurves),
  );

  const hasCurves = [...editedCurves.values()].some((c) => c.type === "pump");

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
      const property = "label" in updates ? "label" : "points";
      userTracking.capture({ name: "pumpCurve.changed", property });
    },
    [userTracking],
  );

  const handleAddCurve = useCallback(
    (label: string, points: CurvePoint[], source: "new" | "clone"): CurveId => {
      const newCurve = buildDefaultPumpCurve(
        editedCurves,
        labelManagerRef.current,
        label,
      );
      newCurve.points = points;
      setEditedCurves((prev) => {
        const next = new Map(prev);
        next.set(newCurve.id, newCurve);
        return next;
      });
      labelManagerRef.current.register(newCurve.label, "curve", newCurve.id);
      userTracking.capture({ name: "pumpCurve.added", source });
      return newCurve.id;
    },
    [editedCurves, userTracking],
  );

  const handleDeleteCurve = useCallback(
    (curveId: CurveId) => {
      const curve = editedCurves.get(curveId);
      if (!curve) return;

      if (curve.assetIds.size > 0) {
        notify({
          variant: "error",
          title: translate("deleteCurveInUse"),
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
      userTracking.capture({ name: "pumpCurve.deleted" });
    },
    [editedCurves, selectedCurveId, translate, userTracking],
  );

  const rep = usePersistence();
  const transact = rep.useTransact();

  const hasChanges = useMemo(
    () => !areCurvesEqual(hydraulicModel.curves, editedCurves),
    [hydraulicModel.curves, editedCurves],
  );

  const handleSave = useCallback(() => {
    if (!hasChanges) {
      closeDialog();
      return;
    }

    const moment = changeCurves(hydraulicModel, {
      curves: editedCurves,
    });
    transact(moment);
    userTracking.capture({
      name: "pumpCurves.updated",
      count: editedCurves.size,
    });

    closeDialog();
  }, [
    hasChanges,
    hydraulicModel,
    editedCurves,
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
    userTracking.capture({ name: "pumpCurves.discarded" });
    closeDialog();
  }, [userTracking, closeDialog]);

  return (
    <DialogContainer size="md" height="lg" onClose={handleCancel}>
      <DialogHeader title={translate("pumpLibrary")} />
      <div className="flex-1 flex min-h-0 gap-4">
        <CurveSidebar
          curves={editedCurves}
          selectedCurveId={selectedCurveId}
          labelManager={labelManagerRef.current}
          onSelectCurve={setSelectedCurveId}
          onAddCurve={handleAddCurve}
          onChangeCurve={handleCurveChange}
          onDeleteCurve={handleDeleteCurve}
          readOnly={isSnapshotLocked}
        />
        <div className="flex-1 flex flex-col min-h-0 w-full">
          {selectedCurveId ? (
            <CurveDetail
              points={getCurvePoints(selectedCurveId)}
              onChange={(points) =>
                handleCurveChange(selectedCurveId, { points })
              }
              readOnly={isSnapshotLocked}
            />
          ) : hasCurves ? (
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
            <Button
              type="button"
              variant="danger"
              onClick={handleDiscard}
              className="whitespace-nowrap"
            >
              {translate("discardChanges")}
            </Button>
            <Button
              type="button"
              onClick={() => setShowDiscardConfirm(false)}
              className="whitespace-nowrap"
            >
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
        <PumpCurvesIcon size={96} />
      </div>
      <p className="text-sm text-gray-600 text-center max-w-64 py-4">
        {translate("pumpLibraryNoSelection")}
      </p>
    </div>
  );
};

const EmptyState = ({ readOnly }: { readOnly: boolean }) => {
  const translate = useTranslate();

  return (
    <div className="flex flex-col items-center justify-center px-4">
      <div className="text-gray-400">
        <PumpCurvesIcon size={96} />
      </div>
      <p className="text-sm font-semibold py-4 text-gray-600">
        {translate("pumpLibraryEmptyTitle")}
      </p>
      {!readOnly && (
        <p className="text-sm text-gray-600 text-center max-w-64">
          {translate("pumpLibraryEmptyDescription")}
        </p>
      )}
    </div>
  );
};

const deepCloneCurves = (curves: Curves): Curves => {
  const cloned = new Map<CurveId, ICurve>();
  for (const [id, curve] of curves) {
    cloned.set(id, {
      ...curve,
      points: curve.points.map((p) => ({ ...p })),
      assetIds: new Set(curve.assetIds),
    });
  }
  return cloned;
};

const createLabelManagerFromCurves = (curves: Curves): LabelManager => {
  const lm = new LabelManager();
  for (const curve of curves.values()) {
    lm.register(curve.label, "curve", curve.id);
  }
  return lm;
};

const areCurvesEqual = (original: Curves, edited: Curves): boolean => {
  if (original.size !== edited.size) return false;
  for (const [id, originalCurve] of original) {
    const editedCurve = edited.get(id);
    if (!editedCurve) return false;
    if (originalCurve.label !== editedCurve.label) return false;
    if (originalCurve.points.length !== editedCurve.points.length) return false;
    if (
      !originalCurve.points.every(
        (p, idx) =>
          p.x === editedCurve.points[idx].x &&
          p.y === editedCurve.points[idx].y,
      )
    )
      return false;
  }
  return true;
};
