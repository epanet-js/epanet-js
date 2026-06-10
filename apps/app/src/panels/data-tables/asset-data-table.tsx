import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import {
  stagingModelDerivedAtom,
  simulationResultsDerivedAtom,
  simulationSettingsDerivedAtom,
} from "src/state/derived-branch-state";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import {
  changeProperties,
  changeLabel,
  changeDemandAssignment,
  mergeMoments,
} from "src/hydraulic-model/model-operations";
import { getJunctionDemands } from "src/hydraulic-model";
import type { JunctionDemandAssignment } from "src/hydraulic-model/model-operation";
import type { ModelMoment } from "src/hydraulic-model";
import {
  tankVolumeCurveChanges,
  chemicalSourceTypeChanges,
  valveKindChanges,
  pumpDefinitionTypeChanges,
} from "src/hydraulic-model/model-operations";
import { activateAssets } from "src/hydraulic-model/model-operations/activate-assets";
import { deactivateAssets } from "src/hydraulic-model/model-operations/deactivate-assets";
import type { PropertyChange } from "src/hydraulic-model/model-operations/change-property";
import { modelFactoriesAtom } from "src/state/model-factories";
import {
  type AssetType,
  type AssetId,
  type PumpDefinitionType,
  type ValveKind,
  type ChemicalSourceType,
  type CurveId,
} from "@epanet-js/hydraulic-model";
import {
  DataGrid,
  type DataGridRef,
  type CellContextAction,
  type GutterContextAction,
  type ClipboardCopyInfo,
  type ClipboardPasteInfo,
  patchModelRow,
} from "src/components/data-grid";
import { useSelectAssetsInApp } from "src/commands/select-assets-in-app";
import { useDeleteAssets } from "src/commands/delete-assets";
import { useUserTracking } from "src/infra/user-tracking";
import { DeleteIcon, PaywallLockIcon, PointerClickIcon } from "src/icons";
import { useFeatureLock } from "src/components/form/paywall";
import { RingSpinner } from "src/components/ring-spinner";
import { notify } from "src/components/notifications";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { projectSettingsAtom } from "src/state/project-settings";
import { useIsEditionBlocked } from "src/hooks/use-is-edition-blocked";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import {
  type AssetRow,
  type AssetAccessorCtx,
  buildRowsAsync,
  buildAssetModelRows,
} from "./data";
import { listPipeMaterials } from "src/hydraulic-model/utilities/pipe-materials";
import { useDeferredGridMount } from "./use-deferred-grid-mount";
import {
  buildColumns,
  EDITABLE_NUMERIC_KEYS,
  EDITABLE_SELECT_KEYS,
  type QualityAnalysisType,
} from "./asset-data-table-columns";

interface AssetDataTableProps {
  assetType: AssetType;
}

export const AssetDataTable = memo(function AssetDataTableInner({
  assetType,
}: AssetDataTableProps) {
  const dataGridRef = useRef<DataGridRef>(null);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const simulation = useAtomValue(simulationResultsDerivedAtom);
  const simulationSettings = useAtomValue(simulationSettingsDerivedAtom);
  const { units, formatting } = useAtomValue(projectSettingsAtom);
  const { labelManager } = useAtomValue(modelFactoriesAtom);
  const { transact } = useModelTransaction();
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const isEditionBlocked = useIsEditionBlocked();
  const isPerfOn = useFeatureFlag("FLAG_DATA_TABLES_PERFORMANCE");
  const selectAssetsInApp = useSelectAssetsInApp();
  const deleteAssetsAction = useDeleteAssets();
  const userTracking = useUserTracking();

  const assetIds = useMemo(() => {
    const ids: AssetId[] = [];
    for (const asset of hydraulicModel.assets.values()) {
      if (asset.type === assetType) ids.push(asset.id);
    }
    return ids;
  }, [hydraulicModel.assets, assetType]);

  const hasSimulation = simulation !== null;

  const qualityType = useMemo((): QualityAnalysisType => {
    if (!simulation) return "none";
    const id = assetIds[0];
    if (id === undefined) return "none";
    let q:
      | {
          waterAge: number | null;
          waterTrace: number | null;
          chemicalConcentration: number | null;
        }
      | null
      | undefined;
    if (assetType === "junction") q = simulation.getJunction(id);
    else if (assetType === "pipe") q = simulation.getPipe(id);
    else if (assetType === "pump") q = simulation.getPump(id);
    else if (assetType === "valve") q = simulation.getValve(id);
    else if (assetType === "reservoir") q = simulation.getReservoir(id);
    else if (assetType === "tank") q = simulation.getTank(id);
    if (!q) return "none";
    if (q.waterAge != null) return "age";
    if (q.waterTrace != null) return "trace";
    if (q.chemicalConcentration != null) return "chemical";
    return "none";
  }, [simulation, assetType, assetIds]);

  const [legacyRows, setLegacyRows] = useState<AssetRow[] | null>(null);
  const modelRows = useMemo(
    () => (isPerfOn ? buildAssetModelRows(assetType, hydraulicModel) : null),
    [isPerfOn, assetType, hydraulicModel],
  );
  const rows = isPerfOn ? modelRows : legacyRows;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  // Defer mounting the model-row grid so switching tabs stays responsive.
  const gridReady = useDeferredGridMount(isPerfOn);

  const {
    isLocked: pipeAttributesLocked,
    openPaywall: openPipeAttributesPaywall,
  } = useFeatureLock("pipeAttributes");
  const pipeMaterials = useMemo(
    () =>
      assetType === "pipe" ? listPipeMaterials(hydraulicModel.assets) : [],
    [assetType, hydraulicModel.assets],
  );
  const accessorCtx = useMemo<AssetAccessorCtx | undefined>(
    () =>
      isPerfOn ? { model: hydraulicModel, simulation, translate } : undefined,
    [isPerfOn, hydraulicModel, simulation, translate],
  );

  const columns = useMemo(() => {
    const validateLabel = (label: string, rowIndex: number) => {
      const assetId = rowsRef.current?.[rowIndex]?.id;
      if (assetId === undefined) return true;
      return labelManager.isLabelAvailable(label, assetType, assetId);
    };
    const getRow = (rowIndex: number) => rowsRef.current?.[rowIndex];
    const lock = pipeAttributesLocked
      ? {
          openPaywall: openPipeAttributesPaywall,
          icon: <PaywallLockIcon />,
        }
      : undefined;
    return buildColumns(
      pipeMaterials,
      lock,
      assetType,
      translate,
      hasSimulation,
      units,
      translateUnit,
      formatting,
      hydraulicModel.patterns,
      hydraulicModel.curves,
      simulationSettings,
      qualityType,
      validateLabel,
      getRow,
      accessorCtx,
    );
  }, [
    assetType,
    pipeAttributesLocked,
    openPipeAttributesPaywall,
    pipeMaterials,
    formatting,
    hasSimulation,
    hydraulicModel.curves,
    hydraulicModel.patterns,
    labelManager,
    qualityType,
    simulationSettings,
    translate,
    translateUnit,
    units,
    accessorCtx,
  ]);

  useEffect(
    function computeRows() {
      if (isPerfOn) return;
      const controller = new AbortController();

      void buildRowsAsync(
        assetType,
        assetIds,
        hydraulicModel,
        simulation,
        translate,
        controller.signal,
      ).then((result) => {
        if (!controller.signal.aborted) setLegacyRows(result);
      });

      return () => controller.abort();
    },
    [isPerfOn, assetType, assetIds, hydraulicModel, simulation, translate],
  );

  const onChange = useCallback(
    (newRows: AssetRow[]) => {
      const editableKeys = [
        ...EDITABLE_NUMERIC_KEYS[assetType],
        ...EDITABLE_SELECT_KEYS[assetType],
      ];
      const moments: ModelMoment[] = [];
      const editedProperties = new Map<string, number>();
      const demandAssignments: JunctionDemandAssignment[] = [];
      for (let i = 0; i < newRows.length; i++) {
        const newRow = newRows[i];
        const oldRow = rowsRef.current?.[i];
        if (!oldRow) continue;
        const assetId = newRow.id;

        if (assetType === "junction") {
          const baseDemandChanged = newRow.baseDemand !== oldRow.baseDemand;
          const patternIdChanged = newRow.patternId !== oldRow.patternId;
          if (baseDemandChanged || patternIdChanged) {
            const existing = getJunctionDemands(
              hydraulicModel.demands,
              assetId,
            );
            const rest = existing.slice(1);
            // Read the unedited field from the model so editing one of
            // base demand / pattern preserves the other (model-object rows
            // don't carry the computed value of the field that wasn't edited).
            const nextBaseDemand = baseDemandChanged
              ? ((newRow.baseDemand as number | null) ?? 0)
              : (existing[0]?.baseDemand ?? 0);
            const nextPatternId = patternIdChanged
              ? ((newRow.patternId as number | null) ?? undefined)
              : (existing[0]?.patternId ?? undefined);
            const isEmptyDefault =
              nextBaseDemand === 0 && nextPatternId === undefined;
            const newDemands =
              isEmptyDefault && rest.length === 0
                ? []
                : [
                    { baseDemand: nextBaseDemand, patternId: nextPatternId },
                    ...rest,
                  ];
            demandAssignments.push({
              junctionId: assetId,
              demands: newDemands,
            });
            if (baseDemandChanged) {
              editedProperties.set(
                "baseDemand",
                (editedProperties.get("baseDemand") ?? 0) + 1,
              );
            }
            if (patternIdChanged) {
              editedProperties.set(
                "patternId",
                (editedProperties.get("patternId") ?? 0) + 1,
              );
            }
          }
        }

        if (
          typeof newRow.label === "string" &&
          newRow.label !== oldRow.label &&
          labelManager.isLabelAvailable(newRow.label, assetType, assetId)
        ) {
          moments.push(
            changeLabel(hydraulicModel, { assetId, newLabel: newRow.label }),
          );
          editedProperties.set(
            "label",
            (editedProperties.get("label") ?? 0) + 1,
          );
        }

        if (newRow.isActive !== oldRow.isActive) {
          const op = newRow.isActive ? activateAssets : deactivateAssets;
          moments.push(op(hydraulicModel, { assetIds: [assetId] }));
          editedProperties.set(
            "isActive",
            (editedProperties.get("isActive") ?? 0) + 1,
          );
        }

        const changes: PropertyChange[] = [];
        for (const key of editableKeys) {
          if (newRow[key] !== oldRow[key]) {
            changes.push({
              property: key,
              value: newRow[key],
            } as PropertyChange);
            editedProperties.set(key, (editedProperties.get(key) ?? 0) + 1);
          }
        }
        if (assetType === "tank") {
          const curveChangeIdx = changes.findIndex(
            (c) => c.property === "volumeCurveId",
          );
          if (curveChangeIdx !== -1) {
            const [curveChange] = changes.splice(curveChangeIdx, 1);
            const curveChanges = tankVolumeCurveChanges(
              hydraulicModel.curves,
              curveChange.value as CurveId | null,
            );
            if (curveChanges) changes.push(...curveChanges);
          }
        }

        if (assetType === "pump") {
          const defTypeIdx = changes.findIndex(
            (c) => c.property === "definitionType",
          );
          if (defTypeIdx !== -1) {
            const [defTypeChange] = changes.splice(defTypeIdx, 1);
            changes.push(
              ...pumpDefinitionTypeChanges(
                defTypeChange.value as PumpDefinitionType,
              ),
            );
          }
        }

        if (assetType === "valve") {
          const kindChangeIdx = changes.findIndex((c) => c.property === "kind");
          if (kindChangeIdx !== -1) {
            const [kindChange] = changes.splice(kindChangeIdx, 1);
            changes.push(
              ...valveKindChanges(
                kindChange.value as ValveKind,
                oldRow.kind as ValveKind,
              ),
            );
          }
        }

        const sourceTypeIdx = changes.findIndex(
          (c) => c.property === "chemicalSourceType",
        );
        if (sourceTypeIdx !== -1) {
          const [sourceTypeChange] = changes.splice(sourceTypeIdx, 1);
          changes.push(
            ...chemicalSourceTypeChanges(
              sourceTypeChange.value as ChemicalSourceType | null,
            ),
          );
        }

        if (changes.length > 0) {
          moments.push(
            changeProperties(hydraulicModel, {
              assetIds: [assetId],
              changes,
            }),
          );
        }
      }

      if (demandAssignments.length > 0) {
        moments.push(changeDemandAssignment(hydraulicModel, demandAssignments));
      }

      const merged = mergeMoments(moments, "Edit asset table");
      if (merged) {
        transact(merged);
        for (const [property, count] of editedProperties) {
          userTracking.capture({
            name: "dataTables.cellEdited",
            type: assetType,
            property,
            count,
          });
        }
      }
    },
    [assetType, hydraulicModel, labelManager, transact, userTracking],
  );

  const getAssetIdsFromSortedRows = useCallback(
    (sortedRows: AssetRow[], minRow: number, maxRow: number): AssetId[] => {
      const ids: AssetId[] = [];
      for (let i = minRow; i <= maxRow && i < sortedRows.length; i++) {
        const id = sortedRows[i]?.id;
        if (id !== undefined) ids.push(id);
      }
      return ids;
    },
    [],
  );

  const deleteAction = useMemo(
    () => ({
      label: translate("delete"),
      icon: <DeleteIcon />,
      variant: "destructive" as const,
      onSelect: (
        selection: { min: { row: number }; max: { row: number } },
        sortedRows: AssetRow[],
      ) => {
        deleteAssetsAction(
          getAssetIdsFromSortedRows(
            sortedRows,
            selection.min.row,
            selection.max.row,
          ),
          "data-table",
        );
      },
    }),
    [translate, deleteAssetsAction, getAssetIdsFromSortedRows],
  );

  const cellContextActions = useMemo<CellContextAction[]>(
    () => [
      {
        label: translate("selectInMap"),
        icon: <PointerClickIcon />,
        onSelect: (selection, sortedRows) => {
          const ids = getAssetIdsFromSortedRows(
            sortedRows as AssetRow[],
            selection.min.row,
            selection.max.row,
          );
          selectAssetsInApp(ids);
          userTracking.capture({
            name: "dataTables.selectedInMap",
            type: assetType,
            source: "cell-context",
            count: ids.length,
          });
        },
      },
      ...(isEditionBlocked ? [] : [deleteAction as CellContextAction]),
    ],
    [
      translate,
      selectAssetsInApp,
      getAssetIdsFromSortedRows,
      isEditionBlocked,
      deleteAction,
      userTracking,
      assetType,
    ],
  );

  const gutterContextActions = useMemo<GutterContextAction[]>(
    () => [
      {
        label: translate("selectInMap"),
        icon: <PointerClickIcon />,
        onSelect: (selection, sortedRows) => {
          const ids = getAssetIdsFromSortedRows(
            sortedRows as AssetRow[],
            selection.min.row,
            selection.max.row,
          );
          selectAssetsInApp(ids);
          userTracking.capture({
            name: "dataTables.selectedInMap",
            type: assetType,
            source: "gutter-context",
            count: ids.length,
          });
        },
      },
      ...(isEditionBlocked ? [] : [deleteAction as GutterContextAction]),
    ],
    [
      translate,
      selectAssetsInApp,
      getAssetIdsFromSortedRows,
      isEditionBlocked,
      deleteAction,
      userTracking,
      assetType,
    ],
  );

  const handleSort = useCallback(
    (columnId: string, direction: "asc" | "desc") => {
      userTracking.capture({
        name: "dataTables.sorted",
        type: assetType,
        property: columnId,
        direction,
      });
    },
    [userTracking, assetType],
  );

  const handleCopy = useCallback(
    (info: ClipboardCopyInfo) => {
      const { rows, cols, allRows, allCols, columnIds } = info;
      userTracking.capture({
        name: "dataTables.copied",
        type: assetType,
        rows,
        cols,
        allRows,
        allCols,
        withHeaders: false,
        columnIds,
      });

      const canIncludeHeaders = allRows;
      if (canIncludeHeaders) {
        notify({
          variant: "default",
          title: translate("dataTables.copy.includeHeadersPrompt"),
          duration: 6000,
          position: "bottom-center",
          action: {
            label: translate("dataTables.copy.includeHeadersAction"),
            variant: "default",
            align: "inline",
            onClick: () => {
              void dataGridRef.current?.copySelection({
                includeHeaders: true,
              });
              userTracking.capture({
                name: "dataTables.copied",
                type: assetType,
                rows,
                cols,
                allRows,
                allCols,
                withHeaders: true,
                columnIds,
              });
            },
          },
        });
      }
    },
    [userTracking, assetType, translate],
  );

  const handlePaste = useCallback(
    (info: ClipboardPasteInfo) => {
      userTracking.capture({
        name: "dataTables.pasted",
        type: assetType,
        ...info,
      });
    },
    [userTracking, assetType],
  );

  return (
    <div className="flex-1 min-h-0 relative">
      {rows === null || !gridReady ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <RingSpinner />
        </div>
      ) : (
        <DataGrid
          ref={dataGridRef}
          key={assetType}
          data={rows}
          columns={columns}
          onChange={onChange}
          createRow={() => ({}) as AssetRow}
          getRowId={(row) => String(row.id)}
          patchRow={isPerfOn ? patchModelRow : undefined}
          gutterColumn="selection"
          resizable
          sortable
          minColumnSizePx={20}
          readOnly={isEditionBlocked}
          cellContextActions={cellContextActions}
          gutterContextActions={gutterContextActions}
          onColumnSort={handleSort}
          onCopy={handleCopy}
          onPaste={handlePaste}
          pinnedColumns={{ left: ["label"] }}
        />
      )}
    </div>
  );
});
