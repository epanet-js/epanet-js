import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useAtomValue } from "jotai";
import { DialogContainer, DialogHeader, useDialogState } from "../../dialog";
import { useTranslate } from "src/hooks/use-translate";
import { Button } from "src/components/elements";
import { PumpLibrarySidebar } from "./pump-library-sidebar";
import { CurveDetail } from "../curves/curve-detail";
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
} from "src/hydraulic-model/curves";
import { PumpLibraryIcon } from "src/icons";
import { dataAtom, stagingModelAtom } from "src/state/jotai";
import { usePersistence } from "src/lib/persistence";
import { changeCurves } from "src/hydraulic-model/model-operations/change-curves";
import { notify } from "src/components/notifications";
import { useUserTracking } from "src/infra/user-tracking";
import { LabelManager } from "src/hydraulic-model/label-manager";
import {
  getCurveTypeConfig,
  deepCloneCurves,
  createLabelManagerFromCurves,
  isCurveInUse,
  areCurvesEqual,
} from "../curves/curve-utils";

type CurveUpdate = Partial<Pick<ICurve, "label" | "points" | "type">>;

export const PumpLibraryDialog = ({
  initialCurveId,
}: {
  initialCurveId?: CurveId;
}) => {
  const translate = useTranslate();
  const { closeDialog } = useDialogState();
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const { modelMetadata } = useAtomValue(dataAtom);
  const userTracking = useUserTracking();
  const isSnapshotLocked = useIsSnapshotLocked();
  const [selectedCurveId, setSelectedCurveId] = useState<CurveId | null>(
    initialCurveId ?? null,
  );
  const [editedCurves, setEditedCurves] = useState<Curves>(() =>
    deepCloneCurves(hydraulicModel.curves),
  );
  const [sidebarWidth, setSidebarWidth] = useState(224);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showSaveWarning, setShowSaveWarning] = useState(false);
  const labelManagerRef = useRef<LabelManager>(
    createLabelManagerFromCurves(editedCurves),
  );

  const hasCurves = editedCurves.size > 0;

  useEffect(
    function trackUncategorizedCurves() {
      const uncategorizedCount = [...hydraulicModel.curves.values()].filter(
        (c) => c.type !== "pump" && c.type !== "efficiency",
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

      if (isCurveInUse(hydraulicModel, curveId)) {
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

  const rep = usePersistence();
  const transact = rep.useTransact();

  const hasChanges = useMemo(
    () => !areCurvesEqual(hydraulicModel.curves, editedCurves),
    [hydraulicModel.curves, editedCurves],
  );

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

  const hasInvalidCurves = invalidCurveIds.size > 0;

  const handleSave = useCallback(() => {
    if (!hasChanges) {
      closeDialog();
      return;
    }

    if (hasInvalidCurves && !showSaveWarning) {
      setShowSaveWarning(true);
      return;
    }

    const moment = changeCurves(hydraulicModel, {
      curves: cleanedCurves,
    });
    transact(moment);
    userTracking.capture({
      name: "curves.updated",
      count: cleanedCurves.size,
    });

    closeDialog();
  }, [
    hasChanges,
    hasInvalidCurves,
    showSaveWarning,
    hydraulicModel,
    cleanedCurves,
    transact,
    closeDialog,
    userTracking,
  ]);

  const handleCancel = useCallback(() => {
    setShowSaveWarning(false);
    if (hasChanges) {
      setShowDiscardConfirm(true);
      return;
    }
    closeDialog();
  }, [hasChanges, closeDialog]);

  const handleDiscard = useCallback(() => {
    userTracking.capture({ name: "curves.discarded" });
    closeDialog();
  }, [userTracking, closeDialog]);

  return (
    <DialogContainer size="md" height="lg" onClose={handleCancel}>
      <DialogHeader title={translate("pumpLibrary")} />
      <div className="flex-1 flex min-h-0">
        <div className="flex-shrink-0 flex">
          <PumpLibrarySidebar
            width={sidebarWidth}
            curves={editedCurves}
            selectedCurveId={selectedCurveId}
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
              const curveConfig = getCurveTypeConfig(curveType);
              const isUncategorized =
                curveType !== "pump" && curveType !== "efficiency";
              return (
                <CurveDetail
                  points={getCurvePoints(selectedCurveId)}
                  onChange={(points) =>
                    handleCurveChange(selectedCurveId, { points })
                  }
                  readOnly={isSnapshotLocked || isUncategorized}
                  curveConfig={curveConfig}
                  xUnit={
                    curveConfig.xQuantity
                      ? modelMetadata.quantities.getUnit(curveConfig.xQuantity)
                      : undefined
                  }
                  yUnit={
                    curveConfig.yQuantity
                      ? modelMetadata.quantities.getUnit(curveConfig.yQuantity)
                      : undefined
                  }
                />
              );
            })()
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
      <div className="mt-6 flex flex-row-reverse gap-x-3 items-end h-8">
        {isSnapshotLocked ? (
          <Button type="button" onClick={closeDialog}>
            {translate("close")}
          </Button>
        ) : showSaveWarning ? (
          <>
            <Button
              type="button"
              variant="danger"
              onClick={handleSave}
              className="whitespace-nowrap"
            >
              {translate("save")}
            </Button>
            <Button
              type="button"
              onClick={() => setShowSaveWarning(false)}
              className="whitespace-nowrap"
            >
              {translate("keepEditing")}
            </Button>
            <span className="text-sm text-gray-600 self-center">
              {translate("curves.saveInvalid")}
            </span>
          </>
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
        <PumpLibraryIcon size={96} />
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
        <PumpLibraryIcon size={96} />
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
