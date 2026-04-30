import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import { TabRoot, TabList, Tab } from "src/components/tab";
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
import type { PropertyChange } from "src/hydraulic-model/model-operations/change-property";
import { modelFactoriesAtom } from "src/state/model-factories";
import type { AssetType } from "src/hydraulic-model/asset-types/types";
import type { AssetId } from "src/hydraulic-model/asset-types/base-asset";
import {
  DataGrid,
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
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { projectSettingsAtom } from "src/state/project-settings";
import { getDecimals } from "src/lib/project-settings";
import type {
  UnitsSpec,
  FormattingSpec,
} from "src/lib/project-settings/quantities-spec";
import type { QuantityProperty } from "src/lib/project-settings/quantities-spec";

type AssetRow = Record<string, unknown> & { id: AssetId };

const ASSET_TYPES: AssetType[] = [
  "junction",
  "pipe",
  "pump",
  "valve",
  "reservoir",
  "tank",
];

const ASSET_TYPE_TAB_KEY: Record<AssetType, string> = {
  junction: "junctions",
  pipe: "pipes",
  pump: "pumps",
  valve: "valves",
  reservoir: "reservoirs",
  tank: "tanks",
};

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

type Simulation = NonNullable<
  ReturnType<typeof useAtomValue<typeof simulationResultsDerivedAtom>>
>;
type TranslateFn = ReturnType<typeof useTranslate>;
type TranslateUnitFn = ReturnType<typeof useTranslateUnit>;
type QualityAnalysisType = "none" | "age" | "trace" | "chemical";

function buildSimRow(
  type: AssetType,
  assetId: AssetId,
  simulation: Simulation,
  translate: TranslateFn,
): Record<string, number | string | null> {
  const qualityFields = (
    sim:
      | {
          waterAge: number | null;
          waterTrace: number | null;
          chemicalConcentration: number | null;
        }
      | null
      | undefined,
  ) => ({
    sim_waterAge: sim?.waterAge ?? null,
    sim_waterTrace: sim?.waterTrace ?? null,
    sim_chemicalConcentration: sim?.chemicalConcentration ?? null,
  });

  switch (type) {
    case "junction": {
      const sim = simulation.getJunction(assetId);
      return {
        sim_pressure: sim?.pressure ?? null,
        sim_head: sim?.head ?? null,
        sim_demand: sim?.demand ?? null,
        ...qualityFields(sim),
      };
    }
    case "pipe": {
      const sim = simulation.getPipe(assetId);
      return {
        sim_flow: sim?.flow ?? null,
        sim_velocity: sim?.velocity ?? null,
        sim_headloss: sim?.headloss ?? null,
        sim_unitHeadloss: sim?.unitHeadloss ?? null,
        sim_status: sim?.status ? translate(`pipe.${sim.status}`) : "",
        ...qualityFields(sim),
      };
    }
    case "pump": {
      const sim = simulation.getPump(assetId);
      const energy = simulation.getPumpEnergy(assetId);
      return {
        sim_flow: sim?.flow ?? null,
        sim_headloss: sim?.headloss ?? null,
        sim_status: sim?.status ? translate(`pump.${sim.status}`) : "",
        ...qualityFields(sim),
        sim_utilization: energy?.utilization ?? null,
        sim_averageEfficiency: energy?.averageEfficiency ?? null,
        sim_averageKwPerFlowUnit: energy?.averageKwPerFlowUnit ?? null,
        sim_averageKw: energy?.averageKw ?? null,
        sim_peakKw: energy?.peakKw ?? null,
        sim_averageCostPerDay: energy?.averageCostPerDay ?? null,
        sim_demandCharge: energy?.demandCharge ?? null,
      };
    }
    case "valve": {
      const sim = simulation.getValve(assetId);
      return {
        sim_flow: sim?.flow ?? null,
        sim_velocity: sim?.velocity ?? null,
        sim_headloss: sim?.headloss ?? null,
        sim_status: sim?.status ? translate(`valve.${sim.status}`) : "",
        ...qualityFields(sim),
      };
    }
    case "reservoir": {
      const r = simulation.getReservoir(assetId);
      return {
        sim_head: r?.head ?? null,
        sim_netFlow: r?.netFlow ?? null,
        ...qualityFields(r),
      };
    }
    case "tank": {
      const sim = simulation.getTank(assetId);
      return {
        sim_head: sim?.head ?? null,
        sim_level: sim?.level ?? null,
        sim_volume: sim?.volume ?? null,
        sim_netFlow: sim?.netFlow ?? null,
        ...qualityFields(sim),
      };
    }
  }
}

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
      readonly: true,
    });
  const simTextValue = (key: string, name: string) =>
    textColumn(key, { header: name, readonly: true });

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
          translate("demand"),
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
  ) =>
    floatColumn(key, {
      header: headerLabel(name, unit),
      decimals:
        property != null
          ? getDecimals(formatting, property)
          : formatting.defaultDecimals,
      readonly: !editable.has(key),
      ...(NULLABLE_KEYS.has(key) ? { nullValue: null, deleteValue: null } : {}),
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
  ) =>
    filterableSelectColumn(key, {
      header: name,
      options: patternOpts(filterType),
      placeholder,
      deleteValue: null,
    });

  const curveCol = (key: string, name: string, filterType: CurveType) =>
    filterableSelectColumn(key, {
      header: name,
      options: curveOpts(filterType),
      placeholder: translate("none"),
      deleteValue: null,
    });

  const chemicalSourceTypeCols = () => [
    filterableSelectColumn("chemicalSourceType", {
      header: translate("chemicalSourceType"),
      options: [
        { value: "none", label: translate("none") },
        ...chemicalSourceTypes.map((t) => ({
          value: t,
          label: translate(`source.${t}`),
        })),
      ],
      placeholder: translate("none"),
      deleteValue: "none",
    }),
    numericCol("chemicalSourceStrength", translate("chemicalSourceStrength")),
    patternCol(
      "chemicalSourcePatternId",
      translate("chemicalSourcePattern"),
      "qualitySourceStrength",
      translate("none"),
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
        filterableSelectColumn("kind", {
          header: translate("valveType"),
          options: valveKinds.map((k) => ({
            value: k,
            label: k.toUpperCase(),
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
        }),
        ...simCols,
      ];
    case "reservoir":
      return [
        textColumn("label", {
          header: translate("label"),
          validate: validateLabel,
        }),
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
        ...chemicalSourceTypeCols(),
        ...simCols,
      ];
  }
}

function assetToRow(asset: {
  id: AssetId;
  feature: { properties: Record<string, unknown> };
}): AssetRow {
  return { id: asset.id, ...asset.feature.properties };
}

export const DataTablesPanel = memo(function DataTablesPanelInner() {
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const simulation = useAtomValue(simulationResultsDerivedAtom);
  const simulationSettings = useAtomValue(simulationSettingsDerivedAtom);
  const { units, formatting } = useAtomValue(projectSettingsAtom);
  const { labelManager } = useAtomValue(modelFactoriesAtom);
  const { transact } = useModelTransaction();
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();

  const assetIdsByType = useMemo(() => {
    const map = new Map<AssetType, AssetId[]>();
    for (const asset of hydraulicModel.assets.values()) {
      const type = asset.type as AssetType;
      const ids = map.get(type);
      if (ids) {
        ids.push(asset.id);
      } else {
        map.set(type, [asset.id]);
      }
    }
    return map;
  }, [hydraulicModel.assets]);

  const presentTypes = useMemo(
    () => ASSET_TYPES.filter((t) => assetIdsByType.has(t)),
    [assetIdsByType],
  );

  const [activeTab, setActiveTab] = useState<AssetType | null>(
    () => presentTypes[0] ?? null,
  );

  const effectiveTab =
    activeTab && assetIdsByType.has(activeTab)
      ? activeTab
      : (presentTypes[0] ?? null);

  const hasSimulation = simulation !== null;

  const qualityType = useMemo((): QualityAnalysisType => {
    if (!simulation) return "none";
    for (const [type, ids] of assetIdsByType) {
      if (ids.length === 0) continue;
      const id = ids[0];
      let q:
        | {
            waterAge: number | null;
            waterTrace: number | null;
            chemicalConcentration: number | null;
          }
        | null
        | undefined;
      if (type === "junction") q = simulation.getJunction(id);
      else if (type === "pipe") q = simulation.getPipe(id);
      else if (type === "pump") q = simulation.getPump(id);
      else if (type === "valve") q = simulation.getValve(id);
      else if (type === "reservoir") q = simulation.getReservoir(id);
      else if (type === "tank") q = simulation.getTank(id);
      if (!q) continue;
      if (q.waterAge != null) return "age";
      if (q.waterTrace != null) return "trace";
      if (q.chemicalConcentration != null) return "chemical";
      return "none";
    }
    return "none";
  }, [simulation, assetIdsByType]);

  const columns = useMemo(
    () =>
      effectiveTab
        ? buildColumns(
            effectiveTab,
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
              return labelManager.isLabelAvailable(
                label,
                effectiveTab,
                assetId,
              );
            },
          )
        : [],
    [
      effectiveTab,
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

  const [rows, setRows] = useState<AssetRow[] | null>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const prevTabRef = useRef<typeof effectiveTab | undefined>(undefined);

  useEffect(
    function updateTableOnTabChange() {
      if (!effectiveTab) {
        setRows([]);
        prevTabRef.current = effectiveTab;
        return;
      }
      const ids = assetIdsByType.get(effectiveTab) ?? [];
      let cancelled = false;
      const tabChanged = prevTabRef.current !== effectiveTab;

      async function compute() {
        if (tabChanged) {
          setRows(null);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        if (cancelled) return;

        const result: AssetRow[] = [];
        for (const id of ids) {
          const asset = hydraulicModel.assets.get(id);
          if (!asset) continue;
          const simFields = simulation
            ? buildSimRow(effectiveTab, id, simulation, translate)
            : {};
          result.push({ ...assetToRow(asset), ...simFields });
        }
        if (!cancelled) {
          setRows(result);
          prevTabRef.current = effectiveTab;
        }
      }

      void compute();
      return () => {
        cancelled = true;
      };
    },
    [
      effectiveTab,
      assetIdsByType,
      hydraulicModel.assets,
      simulation,
      translate,
    ],
  );

  const onChange = useCallback(
    (newRows: AssetRow[]) => {
      if (!effectiveTab) return;
      const editableKeys = [
        ...EDITABLE_NUMERIC_KEYS[effectiveTab],
        ...EDITABLE_SELECT_KEYS[effectiveTab],
      ];
      for (let i = 0; i < newRows.length; i++) {
        const newRow = newRows[i];
        const oldRow = rowsRef.current?.[i];
        if (!oldRow) continue;
        const assetId = newRow.id;

        if (
          typeof newRow.label === "string" &&
          newRow.label !== oldRow.label &&
          labelManager.isLabelAvailable(newRow.label, effectiveTab, assetId)
        ) {
          transact(
            changeLabel(hydraulicModel, { assetId, newLabel: newRow.label }),
          );
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
    [effectiveTab, hydraulicModel, labelManager, transact],
  );

  if (presentTypes.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400 dark:text-gray-600">
        No assets in network
      </div>
    );
  }

  return (
    <TabRoot
      className="absolute inset-0 flex flex-col"
      value={effectiveTab ?? undefined}
      onValueChange={(v) => setActiveTab(v as AssetType)}
    >
      <TabList>
        {presentTypes.map((type) => (
          <Tab key={type} value={type}>
            {translate(ASSET_TYPE_TAB_KEY[type])}
          </Tab>
        ))}
      </TabList>
      <div className="flex-1 min-h-0 relative">
        {rows === null ? (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 dark:text-gray-600">
            <SpinnerIcon />
          </div>
        ) : (
          <DataGrid
            key={effectiveTab}
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
    </TabRoot>
  );
});
