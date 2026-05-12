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
  mergeMoments,
} from "src/hydraulic-model/model-operations";
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
import type { AssetType } from "src/hydraulic-model/asset-types/types";
import type { AssetId } from "src/hydraulic-model/asset-types/base-asset";
import {
  DataGrid,
  booleanColumn,
  floatColumn,
  filterableSelectColumn,
  textColumn,
  type GridColumn,
  type CellContextAction,
  type GutterContextAction,
} from "src/components/data-grid";
import { useSelectAssetsInApp } from "src/commands/select-assets-in-app";
import { useDeleteAssets } from "src/commands/delete-assets";
import { DeleteIcon, PointerClickIcon } from "src/icons";
import { pipeStatuses } from "src/hydraulic-model/asset-types/pipe";
import {
  pumpStatuses,
  type PumpDefinitionType,
} from "src/hydraulic-model/asset-types/pump";
import {
  valveKinds,
  valveStatuses,
  type ValveKind,
} from "src/hydraulic-model/asset-types/valve";
import {
  chemicalSourceTypes,
  type ChemicalSourceType,
} from "src/hydraulic-model/asset-types/node";
import {
  tankMixingModels,
  TANK_TWO_COMPARTMENT_MIXING,
} from "src/hydraulic-model/asset-types/tank";
import type {
  Patterns,
  PatternId,
  PatternType,
} from "src/hydraulic-model/patterns";
import type { Curves, CurveId, CurveType } from "src/hydraulic-model/curves";
import { SpinnerIcon } from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import type { TranslateFn } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { projectSettingsAtom } from "src/state/project-settings";
import { useIsEditionBlocked } from "src/hooks/use-is-edition-blocked";
import { getDecimals } from "src/lib/project-settings";
import { localizeDecimal } from "src/infra/i18n/numbers";
import type { SimulationSettings } from "src/simulation/simulation-settings";
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
    "definitionType",
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
  pump: ["speed", "power", "energyPrice"],
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
        simNumericValue("sim_head", translate("pumpHead"), units.head, "head"),
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
        simNumericValue(
          "sim_pressure",
          translate("pressure"),
          units.pressure,
          "pressure",
        ),
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
        simNumericValue(
          "sim_pressure",
          translate("pressure"),
          units.pressure,
          "pressure",
        ),
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
  simulationSettings: SimulationSettings,
  qualityType: QualityAnalysisType,
  validateLabel?: (label: string, rowIndex: number) => boolean,
  getRow?: (rowIndex: number) => AssetRow | undefined,
): GridColumn[] {
  const energyGlobalPatternId = simulationSettings.energyGlobalPatternId;
  const energyGlobalPrice = simulationSettings.energyGlobalPrice;
  const energyGlobalEfficiency = simulationSettings.energyGlobalEfficiency;
  const reactionGlobalBulk = simulationSettings.reactionGlobalBulk;
  const reactionGlobalWall = simulationSettings.reactionGlobalWall;
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
    placeholder?: string,
  ) =>
    floatColumn(key, {
      header: headerLabel(name, unit),
      decimals:
        property != null
          ? getDecimals(formatting, property)
          : formatting.defaultDecimals,
      isReadOnly: !editable.has(key) ? true : (isReadOnly ?? false),
      placeholder,
      ...(NULLABLE_KEYS.has(key) ? { nullValue: null, deleteValue: null } : {}),
    });

  const booleanCol = (key: string, name: string, isReadOnly = false) =>
    booleanColumn(key, { header: name, isReadOnly });

  const patternOpts = (filterType: PatternType, excludeId?: PatternId) =>
    [...patterns.values()]
      .filter((p) => p.type === filterType && p.id !== excludeId)
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
    excludeId?: PatternId,
  ) =>
    filterableSelectColumn(key, {
      header: name,
      options: patternOpts(filterType, excludeId),
      placeholder,
      emptyOptionLabel: placeholder,
      deleteValue: null,
      isReadOnly,
    });

  const curveCol = (
    key: string,
    name: string,
    filterType: CurveType,
    placeholder?: string,
    isReadOnly?: (rowIndex: number) => boolean,
  ) =>
    filterableSelectColumn(key, {
      header: name,
      options: curveOpts(filterType),
      placeholder: placeholder ?? translate("none"),
      emptyOptionLabel: placeholder ?? translate("none"),
      deleteValue: null,
      isReadOnly,
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
        textColumn("startNode", {
          header: translate("startNode"),
          isReadOnly: true,
        }),
        textColumn("endNode", {
          header: translate("endNode"),
          isReadOnly: true,
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
        floatColumn("customerDemand", {
          header: headerLabel(translate("customerDemand"), units.baseDemand),
          decimals: getDecimals(formatting, "baseDemand"),
          isReadOnly: true,
        }),
        floatColumn("customerPointCount", {
          header: translate("connectedCustomers"),
          decimals: 0,
          isReadOnly: true,
        }),
        floatColumn("bulkReactionCoeff", {
          header: translate("bulkReactionCoeff"),
          decimals: formatting.defaultDecimals,
          deleteValue: null,
          placeholder: localizeDecimal(reactionGlobalBulk),
        }),
        floatColumn("wallReactionCoeff", {
          header: translate("wallReactionCoeff"),
          decimals: formatting.defaultDecimals,
          deleteValue: null,
          placeholder: localizeDecimal(reactionGlobalWall),
        }),
        ...simCols,
      ];
    case "pump":
      return [
        textColumn("label", {
          header: translate("label"),
          validate: validateLabel,
        }),
        booleanCol("isActive", translate("isEnabled")),
        textColumn("startNode", {
          header: translate("startNode"),
          isReadOnly: true,
        }),
        textColumn("endNode", {
          header: translate("endNode"),
          isReadOnly: true,
        }),
        filterableSelectColumn("initialStatus", {
          header: translate("initialStatus"),
          options: pumpStatuses.map((s) => ({
            value: s,
            label: translate(`pump.${s}`),
          })),
        }),
        filterableSelectColumn("definitionType", {
          header: translate("pumpType"),
          options: [
            { value: "power", label: translate("constantPower") },
            {
              value: "designPointCurve",
              label: translate("designPointCurve"),
              enabled: false,
            },
            {
              value: "standardCurve",
              label: translate("standardCurve"),
              enabled: false,
            },
            { value: "curveId", label: translate("namedCurve") },
          ],
        }),
        curveCol(
          "curveId",
          translate("libraryCurve"),
          "pump",
          undefined,
          (rowIndex) => getRow?.(rowIndex)?.definitionType !== "curveId",
        ),
        numericCol(
          "power",
          translate("power"),
          units.power,
          "power",
          (rowIndex) => getRow?.(rowIndex)?.definitionType !== "power",
        ),
        numericCol("speed", translate("initialSpeed"), units.speed, "speed"),
        patternCol("speedPatternId", translate("speedPattern"), "pumpSpeed"),
        curveCol(
          "efficiencyCurveId",
          translate("efficiencyCurve"),
          "efficiency",
          translate("constantPercent", localizeDecimal(energyGlobalEfficiency)),
        ),
        numericCol(
          "energyPrice",
          translate("energyPrice"),
          undefined,
          undefined,
          undefined,
          localizeDecimal(energyGlobalPrice),
        ),
        patternCol(
          "energyPricePatternId",
          translate("energyPricePattern"),
          "energyPrice",
          energyPricePatternPlaceholder,
          undefined,
          energyGlobalPatternId ?? undefined,
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
        textColumn("startNode", {
          header: translate("startNode"),
          isReadOnly: true,
        }),
        textColumn("endNode", {
          header: translate("endNode"),
          isReadOnly: true,
        }),
        filterableSelectColumn("kind", {
          header: translate("valveType"),
          options: valveKinds.map((k) => ({
            value: k,
            label: translate(`valve.${k}.detailed`),
          })),
        }),
        numericCol(
          "setting",
          translate("setting"),
          undefined,
          undefined,
          (rowIndex) => getRow?.(rowIndex)?.kind === "gpv",
        ),
        filterableSelectColumn("curveId", {
          header: translate("valveCurve"),
          options: [...curveOpts("headloss"), ...curveOpts("valve")],
          placeholder: translate("none"),
          emptyOptionLabel: translate("none"),
          deleteValue: null,
          isReadOnly: (rowIndex) => {
            const kind = getRow?.(rowIndex)?.kind;
            return kind !== "gpv" && kind !== "pcv";
          },
        }),
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
          (rowIndex) => getRow?.(rowIndex)?.volumeCurveId != null,
        ),
        numericCol(
          "maxLevel",
          translate("maxLevel"),
          units.maxLevel,
          "maxLevel",
          (rowIndex) => getRow?.(rowIndex)?.volumeCurveId != null,
        ),
        numericCol(
          "minVolume",
          translate("minVolume"),
          units.minVolume,
          "minVolume",
          (rowIndex) => getRow?.(rowIndex)?.volumeCurveId != null,
        ),
        floatColumn("maxVolume", {
          header: headerLabel(translate("maxVolume"), units.minVolume),
          decimals: getDecimals(formatting, "minVolume"),
          isReadOnly: true,
        }),
        numericCol(
          "diameter",
          translate("diameter"),
          units.tankDiameter,
          "tankDiameter",
          (rowIndex) => getRow?.(rowIndex)?.volumeCurveId != null,
        ),
        curveCol("volumeCurveId", translate("volumeCurve"), "volume"),
        booleanCol("overflow", translate("canOverflow")),
        filterableSelectColumn("mixingModel", {
          header: translate("mixingModel"),
          options: tankMixingModels.map((m) => ({
            value: m,
            label: translate(`tank.${m}`),
          })),
          deleteValue: "mixed",
        }),
        floatColumn("mixingFraction", {
          header: translate("mixingFraction"),
          decimals: formatting.defaultDecimals,
          deleteValue: null,
          isReadOnly: (rowIndex) =>
            getRow?.(rowIndex)?.mixingModel !== TANK_TWO_COMPARTMENT_MIXING,
        }),
        numericCol("initialQuality", translate("initialQuality")),
        floatColumn("bulkReactionCoeff", {
          header: translate("bulkReactionCoeff"),
          decimals: formatting.defaultDecimals,
          deleteValue: null,
          placeholder: localizeDecimal(reactionGlobalBulk),
        }),
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
  const isEditionBlocked = useIsEditionBlocked();
  const selectAssetsInApp = useSelectAssetsInApp();
  const deleteAssetsAction = useDeleteAssets();

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
        simulationSettings,
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
      simulationSettings,
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
      const moments: ModelMoment[] = [];
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
          moments.push(
            changeLabel(hydraulicModel, { assetId, newLabel: newRow.label }),
          );
        }

        if (newRow.isActive !== oldRow.isActive) {
          const op = newRow.isActive ? activateAssets : deactivateAssets;
          moments.push(op(hydraulicModel, { assetIds: [assetId] }));
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
            changeProperties(hydraulicModel, { assetIds: [assetId], changes }),
          );
        }
      }

      const merged = mergeMoments(moments, "Edit asset table");
      if (merged) transact(merged);
    },
    [assetType, hydraulicModel, labelManager, transact],
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
          selectAssetsInApp(
            getAssetIdsFromSortedRows(
              sortedRows as AssetRow[],
              selection.min.row,
              selection.max.row,
            ),
          );
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
    ],
  );

  const gutterContextActions = useMemo<GutterContextAction[]>(
    () => [
      {
        label: translate("selectInMap"),
        icon: <PointerClickIcon />,
        onSelect: (selection, sortedRows) => {
          selectAssetsInApp(
            getAssetIdsFromSortedRows(
              sortedRows as AssetRow[],
              selection.min.row,
              selection.max.row,
            ),
          );
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
    ],
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
          gutterColumn="selection"
          resizable
          sortable
          minColumnSizePx={20}
          readOnly={isEditionBlocked}
          cellContextActions={cellContextActions}
          gutterContextActions={gutterContextActions}
        />
      )}
    </div>
  );
});
