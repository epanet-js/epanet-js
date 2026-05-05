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
} from "src/hydraulic-model/model-operations";
import { activateAssets } from "src/hydraulic-model/model-operations/activate-assets";
import { deactivateAssets } from "src/hydraulic-model/model-operations/deactivate-assets";
import type { PropertyChange } from "src/hydraulic-model/model-operations/change-property";
import { modelFactoriesAtom } from "src/state/model-factories";
import type { AssetType } from "src/hydraulic-model/asset-types/types";
import type { AssetId } from "src/hydraulic-model/asset-types/base-asset";
import {
  DataGrid,
  booleanColumn,
  floatColumn,
  filterableSelectColumn,
  textColumn,
  type GridColumn,
} from "src/components/data-grid";
import { pipeStatuses } from "src/hydraulic-model/asset-types/pipe";
import { pumpStatuses } from "src/hydraulic-model/asset-types/pump";
import {
  valveKinds,
  valveStatuses,
} from "src/hydraulic-model/asset-types/valve";
import { chemicalSourceTypes } from "src/hydraulic-model/asset-types/node";
import { tankMixingModels } from "src/hydraulic-model/asset-types/tank";
import type {
  Patterns,
  PatternId,
  PatternType,
} from "src/hydraulic-model/patterns";
import type { Curves, CurveType } from "src/hydraulic-model/curves";
import { SpinnerIcon } from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import type { TranslateFn } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { projectSettingsAtom } from "src/state/project-settings";
import { getDecimals } from "src/lib/project-settings";
import type {
  UnitsSpec,
  FormattingSpec,
} from "src/lib/project-settings/quantities-spec";
import type { QuantityProperty } from "src/lib/project-settings/quantities-spec";
import { type AssetRow, buildRows } from "./data";

const EDITABLE_SELECT_KEYS: Record<AssetType, string[]> = {
  junction: ["chemicalSourceType", "chemicalSourcePatternId"],
  pipe: ["initialStatus"],
  pump: [
    "initialStatus",
    "curveId",
    "speedPatternId",
    "efficiencyCurveId",
    "energyPricePatternId",
  ],
  valve: ["kind", "initialStatus", "curveId"],
  reservoir: ["headPatternId", "chemicalSourceType", "chemicalSourcePatternId"],
  tank: [
    "overflow",
    "mixingModel",
    "volumeCurveId",
    "chemicalSourceType",
    "chemicalSourcePatternId",
  ],
};

const EDITABLE_NUMERIC_KEYS: Record<AssetType, string[]> = {
  junction: [
    "elevation",
    "emitterCoefficient",
    "initialQuality",
    "chemicalSourceStrength",
  ],
  pipe: [
    "diameter",
    "length",
    "roughness",
    "minorLoss",
    "bulkReactionCoeff",
    "wallReactionCoeff",
  ],
  pump: ["speed", "energyPrice"],
  valve: ["setting", "diameter", "minorLoss"],
  reservoir: ["elevation", "head", "initialQuality", "chemicalSourceStrength"],
  tank: [
    "elevation",
    "initialLevel",
    "minLevel",
    "maxLevel",
    "minVolume",
    "diameter",
    "initialQuality",
    "bulkReactionCoeff",
    "mixingFraction",
    "chemicalSourceStrength",
  ],
};

const NULLABLE_KEYS = new Set([
  "bulkReactionCoeff",
  "wallReactionCoeff",
  "energyPrice",
  "chemicalSourceStrength",
  "mixingFraction",
]);

type TranslateUnitFn = ReturnType<typeof useTranslateUnit>;
type QualityAnalysisType = "none" | "age" | "trace" | "chemical";

function buildSimColumns(
  type: AssetType,
  translate: TranslateFn,
  units: UnitsSpec,
  translateUnit: TranslateUnitFn,
  formatting: FormattingSpec,
  qualityType: QualityAnalysisType,
): GridColumn[] {
  const headerLabel = (
    name: string,
    unit: Parameters<TranslateUnitFn>[0] = null,
  ) => {
    const unitLabel = translateUnit(unit);
    return unitLabel ? `${name} (${unitLabel})` : name;
  };
  const simNumericValue = (
    key: string,
    name: string,
    unit: Parameters<TranslateUnitFn>[0],
    property?: QuantityProperty,
  ) =>
    floatColumn(key, {
      header: headerLabel(name, unit),
      decimals:
        property != null
          ? getDecimals(formatting, property)
          : formatting.defaultDecimals,
      isReadOnly: true,
    });
  const simTextValue = (key: string, name: string) =>
    textColumn(key, { header: name, isReadOnly: true });

  const qualityCols = (): GridColumn[] => {
    if (qualityType === "age")
      return [
        simNumericValue(
          "sim_waterAge",
          translate("waterAge"),
          units.waterAge,
          "waterAge",
        ),
      ];
    if (qualityType === "trace")
      return [
        simNumericValue(
          "sim_waterTrace",
          translate("waterTrace"),
          units.waterTrace,
          "waterTrace",
        ),
      ];
    if (qualityType === "chemical")
      return [
        simNumericValue(
          "sim_chemicalConcentration",
          translate("chemicalConcentration"),
          units.chemicalConcentration,
          "chemicalConcentration",
        ),
      ];
    return [];
  };

  switch (type) {
    case "junction":
      return [
        simNumericValue(
          "sim_pressure",
          translate("pressure"),
          units.pressure,
          "pressure",
        ),
        simNumericValue("sim_head", translate("head"), units.head, "head"),
        simNumericValue(
          "sim_demand",
          translate("actualDemand"),
          units.actualDemand,
          "actualDemand",
        ),
        ...qualityCols(),
      ];
    case "pipe":
      return [
        simNumericValue("sim_flow", translate("flow"), units.flow, "flow"),
        simNumericValue(
          "sim_velocity",
          translate("velocity"),
          units.velocity,
          "velocity",
        ),
        simNumericValue(
          "sim_headloss",
          translate("headlossShort"),
          units.headloss,
          "headloss",
        ),
        simNumericValue(
          "sim_unitHeadloss",
          translate("unitHeadloss"),
          units.unitHeadloss,
          "unitHeadloss",
        ),
        simTextValue("sim_status", translate("actualStatus")),
        ...qualityCols(),
      ];
    case "pump":
      return [
        simNumericValue("sim_flow", translate("flow"), units.flow, "flow"),
        simNumericValue(
          "sim_headloss",
          translate("pumpHead"),
          units.headloss,
          "headloss",
        ),
        simTextValue("sim_status", translate("actualStatus")),
        ...qualityCols(),
        simNumericValue(
          "sim_utilization",
          translate("utilization"),
          units.efficiency,
          "efficiency",
        ),
        simNumericValue(
          "sim_averageEfficiency",
          translate("averageEfficiency"),
          units.efficiency,
          "efficiency",
        ),
        simNumericValue(
          "sim_averageKwPerFlowUnit",
          translate("averageKwPerFlowUnit"),
          units.averageKwPerFlowUnit,
          "averageKwPerFlowUnit",
        ),
        simNumericValue(
          "sim_averageKw",
          translate("averageKw"),
          units.power,
          "power",
        ),
        simNumericValue(
          "sim_peakKw",
          translate("peakKw"),
          units.power,
          "power",
        ),
        simNumericValue(
          "sim_averageCostPerDay",
          translate("averageCostPerDay"),
          null,
        ),
        simNumericValue("sim_demandCharge", translate("demandCharge"), null),
      ];
    case "valve":
      return [
        simNumericValue("sim_flow", translate("flow"), units.flow, "flow"),
        simNumericValue(
          "sim_velocity",
          translate("velocity"),
          units.velocity,
          "velocity",
        ),
        simNumericValue(
          "sim_headloss",
          translate("headlossShort"),
          units.headloss,
          "headloss",
        ),
        simTextValue("sim_status", translate("actualStatus")),
        ...qualityCols(),
      ];
    case "reservoir":
      return [
        simNumericValue("sim_head", translate("head"), units.head, "head"),
        simNumericValue(
          "sim_netFlow",
          translate("netFlow"),
          units.netFlow,
          "netFlow",
        ),
        ...qualityCols(),
      ];
    case "tank":
      return [
        simNumericValue("sim_head", translate("head"), units.head, "head"),
        simNumericValue("sim_level", translate("level"), units.level, "level"),
        simNumericValue(
          "sim_volume",
          translate("volume"),
          units.volume,
          "volume",
        ),
        simNumericValue(
          "sim_netFlow",
          translate("netFlow"),
          units.netFlow,
          "netFlow",
        ),
        ...qualityCols(),
      ];
  }
}

function buildColumns(
  type: AssetType,
  translate: TranslateFn,
  hasSimulation: boolean,
  units: UnitsSpec,
  translateUnit: TranslateUnitFn,
  formatting: FormattingSpec,
  patterns: Patterns,
  curves: Curves,
  energyGlobalPatternId: PatternId | null,
  qualityType: QualityAnalysisType,
  validateLabel?: (label: string, rowIndex: number) => boolean,
  getRow?: (rowIndex: number) => AssetRow | undefined,
): GridColumn[] {
  const editable = new Set(EDITABLE_NUMERIC_KEYS[type]);

  const headerLabel = (
    name: string,
    unit: Parameters<TranslateUnitFn>[0] = null,
  ) => {
    const unitLabel = translateUnit(unit);
    return unitLabel ? `${name} (${unitLabel})` : name;
  };

  const numericCol = (
    key: string,
    name: string,
    unit: Parameters<TranslateUnitFn>[0] = null,
    property?: QuantityProperty,
    isReadOnly?: (rowIndex: number) => boolean,
  ) =>
    floatColumn(key, {
      header: headerLabel(name, unit),
      decimals:
        property != null
          ? getDecimals(formatting, property)
          : formatting.defaultDecimals,
      isReadOnly: !editable.has(key) ? true : (isReadOnly ?? false),
      ...(NULLABLE_KEYS.has(key) ? { nullValue: null, deleteValue: null } : {}),
    });

  const booleanCol = (key: string, name: string, isReadOnly = false) =>
    booleanColumn(key, {
      header: name,
      trueLabel: translate("yes"),
      falseLabel: translate("no"),
      isReadOnly,
    });

  const patternOpts = (filterType: PatternType) =>
    [...patterns.values()]
      .filter((p) => p.type === filterType)
      .map((p) => ({ value: p.id, label: p.label }));

  const curveOpts = (filterType: CurveType) =>
    [...curves.values()]
      .filter((c) => c.type === filterType)
      .map((c) => ({ value: c.id, label: c.label }));

  const energyPricePatternPlaceholder = (() => {
    if (energyGlobalPatternId !== null) {
      const p = patterns.get(energyGlobalPatternId);
      if (p) return p.label;
    }
    return translate("constant");
  })();

  const patternCol = (
    key: string,
    name: string,
    filterType: PatternType,
    placeholder = translate("constant"),
    isReadOnly?: (rowIndex: number) => boolean,
  ) =>
    filterableSelectColumn(key, {
      header: name,
      options: patternOpts(filterType),
      placeholder,
      deleteValue: null,
      isReadOnly,
    });

  const curveCol = (key: string, name: string, filterType: CurveType) =>
    filterableSelectColumn(key, {
      header: name,
      options: curveOpts(filterType),
      placeholder: translate("none"),
      deleteValue: null,
    });

  const isChemicalSourceNone = (rowIndex: number) => {
    const row = getRow?.(rowIndex);
    return row?.chemicalSourceType == null;
  };

  const chemicalSourceTypeCols = () => [
    filterableSelectColumn("chemicalSourceType", {
      header: translate("chemicalSourceType"),
      options: chemicalSourceTypes.map((t) => ({
        value: t,
        label: translate(`source.${t}`),
      })),
      emptyOptionLabel: translate("none"),
      placeholder: translate("none"),
      deleteValue: null,
    }),
    numericCol(
      "chemicalSourceStrength",
      translate("chemicalSourceStrength"),
      undefined,
      undefined,
      isChemicalSourceNone,
    ),
    patternCol(
      "chemicalSourcePatternId",
      translate("chemicalSourcePattern"),
      "qualitySourceStrength",
      translate("none"),
      isChemicalSourceNone,
    ),
  ];

  const simCols = hasSimulation
    ? buildSimColumns(
        type,
        translate,
        units,
        translateUnit,
        formatting,
        qualityType,
      )
    : [];

  switch (type) {
    case "junction":
      return [
        textColumn("label", {
          header: translate("label"),
          validate: validateLabel,
        }),
        booleanCol("isActive", translate("isEnabled"), true),
        numericCol(
          "elevation",
          translate("elevation"),
          units.elevation,
          "elevation",
        ),
        numericCol(
          "emitterCoefficient",
          translate("emitterCoefficient"),
          units.emitterCoefficient,
          "emitterCoefficient",
        ),
        floatColumn("avgDemand", {
          header: headerLabel(translate("directDemand"), units.baseDemand),
          decimals: getDecimals(formatting, "baseDemand"),
          isReadOnly: true,
        }),
        floatColumn("avgCustomerDemand", {
          header: headerLabel(translate("customerDemand"), units.baseDemand),
          decimals: getDecimals(formatting, "baseDemand"),
          isReadOnly: true,
        }),
        floatColumn("customerPointCount", {
          header: translate("connectedCustomers"),
          decimals: 0,
          isReadOnly: true,
        }),
        numericCol("initialQuality", translate("initialQuality")),
        ...chemicalSourceTypeCols(),
        ...simCols,
      ];
    case "pipe":
      return [
        textColumn("label", {
          header: translate("label"),
          validate: validateLabel,
        }),
        booleanCol("isActive", translate("isEnabled")),
        filterableSelectColumn("initialStatus", {
          header: translate("initialStatus"),
          options: pipeStatuses.map((s) => ({
            value: s,
            label: translate(`pipe.${s}`),
          })),
        }),
        numericCol(
          "diameter",
          translate("diameter"),
          units.diameter,
          "diameter",
        ),
        numericCol("length", translate("length"), units.length, "length"),
        numericCol("roughness", translate("roughness"), units.roughness),
        numericCol(
          "minorLoss",
          translate("minorLoss"),
          units.minorLoss,
          "minorLoss",
        ),
        numericCol("bulkReactionCoeff", translate("bulkReactionCoeff")),
        numericCol("wallReactionCoeff", translate("wallReactionCoeff")),
        ...simCols,
      ];
    case "pump":
      return [
        textColumn("label", {
          header: translate("label"),
          validate: validateLabel,
        }),
        booleanCol("isActive", translate("isEnabled")),
        filterableSelectColumn("initialStatus", {
          header: translate("initialStatus"),
          options: pumpStatuses.map((s) => ({
            value: s,
            label: translate(`pump.${s}`),
          })),
        }),
        numericCol("speed", translate("initialSpeed"), units.speed, "speed"),
        curveCol("curveId", translate("pumpCurve"), "pump"),
        numericCol("energyPrice", translate("energyPrice")),
        patternCol("speedPatternId", translate("speedPattern"), "pumpSpeed"),
        curveCol(
          "efficiencyCurveId",
          translate("efficiencyCurve"),
          "efficiency",
        ),
        patternCol(
          "energyPricePatternId",
          translate("energyPricePattern"),
          "energyPrice",
          energyPricePatternPlaceholder,
        ),
        ...simCols,
      ];
    case "valve":
      return [
        textColumn("label", {
          header: translate("label"),
          validate: validateLabel,
        }),
        booleanCol("isActive", translate("isEnabled")),
        filterableSelectColumn("kind", {
          header: translate("valveType"),
          options: valveKinds.map((k) => ({
            value: k,
            label: translate(`valve.${k}.detailed`),
          })),
        }),
        numericCol("setting", translate("setting")),
        filterableSelectColumn("initialStatus", {
          header: translate("initialStatus"),
          options: valveStatuses.map((s) => ({
            value: s,
            label: translate(`valve.${s}`),
          })),
        }),
        numericCol(
          "diameter",
          translate("diameter"),
          units.diameter,
          "diameter",
        ),
        numericCol(
          "minorLoss",
          translate("minorLoss"),
          units.minorLoss,
          "minorLoss",
        ),
        filterableSelectColumn("curveId", {
          header: translate("curve"),
          options: [...curveOpts("headloss"), ...curveOpts("valve")],
          placeholder: translate("none"),
          deleteValue: null,
          isReadOnly: (rowIndex) => {
            const kind = getRow?.(rowIndex)?.kind;
            return kind !== "gpv" && kind !== "pcv";
          },
        }),
        ...simCols,
      ];
    case "reservoir":
      return [
        textColumn("label", {
          header: translate("label"),
          validate: validateLabel,
        }),
        booleanCol("isActive", translate("isEnabled"), true),
        numericCol(
          "elevation",
          translate("elevation"),
          units.elevation,
          "elevation",
        ),
        numericCol("head", translate("head"), units.head, "head"),
        patternCol("headPatternId", translate("headPattern"), "reservoirHead"),
        numericCol("initialQuality", translate("initialQuality")),
        ...chemicalSourceTypeCols(),
        ...simCols,
      ];
    case "tank":
      return [
        textColumn("label", {
          header: translate("label"),
          validate: validateLabel,
        }),
        booleanCol("isActive", translate("isEnabled"), true),
        numericCol(
          "elevation",
          translate("elevation"),
          units.elevation,
          "elevation",
        ),
        numericCol(
          "initialLevel",
          translate("initialLevel"),
          units.initialLevel,
          "initialLevel",
        ),
        numericCol(
          "minLevel",
          translate("minLevel"),
          units.minLevel,
          "minLevel",
        ),
        numericCol(
          "maxLevel",
          translate("maxLevel"),
          units.maxLevel,
          "maxLevel",
        ),
        numericCol(
          "minVolume",
          translate("minVolume"),
          units.minVolume,
          "minVolume",
        ),
        numericCol(
          "diameter",
          translate("diameter"),
          units.tankDiameter,
          "tankDiameter",
        ),
        curveCol("volumeCurveId", translate("volumeCurve"), "volume"),
        numericCol("initialQuality", translate("initialQuality")),
        numericCol("bulkReactionCoeff", translate("bulkReactionCoeff")),
        filterableSelectColumn("mixingModel", {
          header: translate("mixingModel"),
          options: tankMixingModels.map((m) => ({
            value: m,
            label: translate(`tank.${m}`),
          })),
          deleteValue: "mixed",
        }),
        numericCol("mixingFraction", translate("mixingFraction")),
        booleanCol("overflow", translate("canOverflow")),
        ...chemicalSourceTypeCols(),
        ...simCols,
      ];
  }
}

interface AssetDataTableProps {
  assetType: AssetType;
}

export const AssetDataTable = memo(function AssetDataTableInner({
  assetType,
}: AssetDataTableProps) {
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const simulation = useAtomValue(simulationResultsDerivedAtom);
  const simulationSettings = useAtomValue(simulationSettingsDerivedAtom);
  const { units, formatting } = useAtomValue(projectSettingsAtom);
  const { labelManager } = useAtomValue(modelFactoriesAtom);
  const { transact } = useModelTransaction();
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();

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

  const [rows, setRows] = useState<AssetRow[] | null>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const columns = useMemo(
    () =>
      buildColumns(
        assetType,
        translate,
        hasSimulation,
        units,
        translateUnit,
        formatting,
        hydraulicModel.patterns,
        hydraulicModel.curves,
        simulationSettings?.energyGlobalPatternId ?? null,
        qualityType,
        (label: string, rowIndex: number) => {
          const assetId = rowsRef.current?.[rowIndex]?.id;
          if (assetId === undefined) return true;
          return labelManager.isLabelAvailable(label, assetType, assetId);
        },
        (rowIndex: number) => rowsRef.current?.[rowIndex],
      ),
    [
      assetType,
      translate,
      hasSimulation,
      units,
      translateUnit,
      formatting,
      hydraulicModel.patterns,
      hydraulicModel.curves,
      simulationSettings?.energyGlobalPatternId,
      qualityType,
      labelManager,
    ],
  );

  useEffect(
    function computeRows() {
      let cancelled = false;

      async function compute() {
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (cancelled) return;

        const result = buildRows(
          assetType,
          assetIds,
          hydraulicModel,
          simulation,
          translate,
        );
        if (!cancelled) setRows(result);
      }

      void compute();
      return () => {
        cancelled = true;
      };
    },
    [assetType, assetIds, hydraulicModel, simulation, translate],
  );

  const onChange = useCallback(
    (newRows: AssetRow[]) => {
      const editableKeys = [
        ...EDITABLE_NUMERIC_KEYS[assetType],
        ...EDITABLE_SELECT_KEYS[assetType],
      ];
      for (let i = 0; i < newRows.length; i++) {
        const newRow = newRows[i];
        const oldRow = rowsRef.current?.[i];
        if (!oldRow) continue;
        const assetId = newRow.id;

        if (
          typeof newRow.label === "string" &&
          newRow.label !== oldRow.label &&
          labelManager.isLabelAvailable(newRow.label, assetType, assetId)
        ) {
          transact(
            changeLabel(hydraulicModel, { assetId, newLabel: newRow.label }),
          );
        }

        if (newRow.isActive !== oldRow.isActive) {
          const op = newRow.isActive ? activateAssets : deactivateAssets;
          transact(op(hydraulicModel, { assetIds: [assetId] }));
        }

        const changes: PropertyChange[] = [];
        for (const key of editableKeys) {
          if (newRow[key] !== oldRow[key]) {
            changes.push({
              property: key,
              value: newRow[key],
            } as PropertyChange);
          }
        }
        if (changes.length > 0) {
          transact(
            changeProperties(hydraulicModel, { assetIds: [assetId], changes }),
          );
        }
      }
    },
    [assetType, hydraulicModel, labelManager, transact],
  );

  return (
    <div className="flex-1 min-h-0 relative">
      {rows === null ? (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 dark:text-gray-600">
          <SpinnerIcon />
        </div>
      ) : (
        <DataGrid
          key={assetType}
          data={rows}
          columns={columns}
          onChange={onChange as (data: Record<string, unknown>[]) => void}
          createRow={() => ({}) as Record<string, unknown>}
          gutterColumn={false}
          resizable
          sortable
          minColumnSizePx={100}
        />
      )}
    </div>
  );
});
