import {
  booleanColumn,
  floatColumn,
  integerColumn,
  filterableSelectColumn,
  textColumn,
  type GridColumn,
  type ColumnKey,
} from "src/components/data-grid";
import type { ReactNode } from "react";
import type { CustomHeaderAction } from "src/components/data-grid/features";
import { type CustomAttribute } from "@epanet-js/custom-attributes";
import { type Asset } from "@epanet-js/hydraulic-model";
import {
  type AssetType,
  pipeStatuses,
  pumpStatuses,
  valveKinds,
  valveStatuses,
  chemicalSourceTypes,
  tankMixingModels,
  TANK_TWO_COMPARTMENT_MIXING,
  type Patterns,
  type PatternId,
  type PatternType,
  type Curves,
  type CurveType,
  LabelManager,
  DEFAULT_MINOR_LOSS,
  DEFAULT_EMITTER_COEFFICIENT,
  DEFAULT_MIN_VOLUME,
  DEFAULT_MIXING_FRACTION,
  DEFAULT_SPEED,
  DEFAULT_INITIAL_QUALITY,
} from "@epanet-js/hydraulic-model";
import type { TranslateFn } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { getDecimals } from "src/lib/project-settings";
import { localizeDecimal } from "src/infra/i18n/numbers";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import type {
  UnitsSpec,
  FormattingSpec,
  QuantityProperty,
} from "src/lib/project-settings/quantities-spec";
import {
  type AssetRow,
  type AssetAccessorCtx,
  assetAccessor,
  isAssetComputedKey,
} from "./data";
import { fieldValidator } from "src/lib/model-attributes-validation";

function makeCk(type: AssetType, accessorCtx?: AssetAccessorCtx) {
  return (key: string): ColumnKey<AssetRow, never> => {
    if (accessorCtx && isAssetComputedKey(type, key)) {
      return {
        id: key,
        accessorFn: assetAccessor(type, key, accessorCtx) as (
          row: AssetRow,
        ) => never,
      };
    }
    return key;
  };
}

type Ck = ReturnType<typeof makeCk>;

export const EDITABLE_SELECT_KEYS: Record<AssetType, string[]> = {
  junction: ["chemicalSourceType", "chemicalSourcePatternId"],
  pipe: ["initialStatus", "material"],
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

export const EDITABLE_NUMERIC_KEYS: Record<AssetType, string[]> = {
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
    "year",
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

export const OPTIONAL_KEYS = new Set([
  "bulkReactionCoeff",
  "wallReactionCoeff",
  "energyPrice",
  "chemicalSourceStrength",
]);

export const NON_ZERO_KEYS = new Set([
  "diameter",
  "length",
  "roughness",
  "maxLevel",
  "mixingFraction",
  "power",
]);

const NULLABLE_KEYS = new Set([
  "roughness",
  "head",
  "initialLevel",
  "setting",
  "diameter",
]);

const FLAG_OPTIONAL_KEYS = new Set([
  "minorLoss",
  "emitterCoefficient",
  "minVolume",
  "mixingFraction",
  "speed",
  "initialQuality",
]);

// EPANET default shown as a placeholder for an empty optional column.
const optionalColumnPlaceholder = (key: string): string | undefined => {
  switch (key) {
    case "minorLoss":
      return String(DEFAULT_MINOR_LOSS);
    case "emitterCoefficient":
      return String(DEFAULT_EMITTER_COEFFICIENT);
    case "minVolume":
      return String(DEFAULT_MIN_VOLUME);
    case "mixingFraction":
      return String(DEFAULT_MIXING_FRACTION);
    case "speed":
      return String(DEFAULT_SPEED);
    case "initialQuality":
      return String(DEFAULT_INITIAL_QUALITY);
    default:
      return undefined;
  }
};

export const isOptionalColumn = (
  key: string,
  allowsNullValues?: boolean,
): boolean =>
  OPTIONAL_KEYS.has(key) || (!!allowsNullValues && FLAG_OPTIONAL_KEYS.has(key));

export const isNullableColumn = (
  key: string,
  allowsNullValues?: boolean,
): boolean => !!allowsNullValues && NULLABLE_KEYS.has(key);

export const isEmptiableColumn = (
  key: string,
  allowsNullValues?: boolean,
): boolean =>
  isOptionalColumn(key, allowsNullValues) ||
  isNullableColumn(key, allowsNullValues);

type TranslateUnitFn = ReturnType<typeof useTranslateUnit>;
export type QualityAnalysisType = "none" | "age" | "trace" | "chemical";

type SimColsArgs = [
  type: AssetType,
  translate: TranslateFn,
  units: UnitsSpec,
  translateUnit: TranslateUnitFn,
  formatting: FormattingSpec,
  qualityType: QualityAnalysisType,
];

function makeSimColHelpers(
  translate: TranslateFn,
  units: UnitsSpec,
  translateUnit: TranslateUnitFn,
  formatting: FormattingSpec,
  qualityType: QualityAnalysisType,
  ck: Ck,
) {
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
  ): GridColumn<AssetRow> =>
    floatColumn(ck(key), {
      header: headerLabel(name, unit),
      decimals:
        property != null
          ? getDecimals(formatting, property)
          : formatting.defaultDecimals,
      isReadOnly: true,
    });
  const simTextValue = (key: string, name: string): GridColumn<AssetRow> =>
    textColumn(ck(key), { header: name, isReadOnly: true });
  const qualityCols = (): GridColumn<AssetRow>[] => {
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
  return { simNumericValue, simTextValue, qualityCols };
}

function buildSimColumns(
  ck: Ck,
  ...[
    type,
    translate,
    units,
    translateUnit,
    formatting,
    qualityType,
  ]: SimColsArgs
): GridColumn<AssetRow>[] {
  const { simNumericValue, simTextValue, qualityCols } = makeSimColHelpers(
    translate,
    units,
    translateUnit,
    formatting,
    qualityType,
    ck,
  );

  const pressureStatsCols = (): GridColumn<AssetRow>[] => [
    simNumericValue(
      "sim_minPressure",
      translate("minPressure"),
      units.pressure,
      "pressure",
    ),
    simNumericValue(
      "sim_maxPressure",
      translate("maxPressure"),
      units.pressure,
      "pressure",
    ),
  ];

  switch (type) {
    case "junction":
      return [
        simNumericValue(
          "sim_pressure",
          translate("pressure"),
          units.pressure,
          "pressure",
        ),
        ...pressureStatsCols(),
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
        ...pressureStatsCols(),
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
        ...pressureStatsCols(),
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

type BuildColumnsArgs = [
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
  validateLabel?: (label: string, row: AssetRow) => boolean,
  getRow?: (rowIndex: number) => AssetRow | undefined,
  accessorCtx?: AssetAccessorCtx,
  allowsNullValues?: boolean,
  customAttributes?: CustomAttribute[],
];

type ExtraPipeColsFn = (
  translate: TranslateFn,
  formatting: FormattingSpec,
  allowsNullValues?: boolean,
) => GridColumn<AssetRow>[];

type PipeAttributesLock = {
  openPaywall: () => void;
  icon: ReactNode;
};

function pipeAttributeColsFor(
  materials: string[],
  lock?: PipeAttributesLock,
): ExtraPipeColsFn {
  return (translate, _formatting, allowsNullValues): GridColumn<AssetRow>[] => {
    const cols: GridColumn<AssetRow>[] = [
      filterableSelectColumn("material", {
        header: translate("material"),
        options: materials.map((m) => ({ value: m, label: m })),
        placeholder: translate("none"),
        emptyOptionLabel: translate("none"),
        emptyValue: null,
        allowNew: true,
        createLabel: (query) => translate("addNewValue", query),
        isReadOnly: !!lock,
      }),
      integerColumn("year", {
        header: translate("yearOfInstallation"),
        emptyValue: null,
        validate: fieldValidator("pipe", "year"),
        commitInvalidValues: allowsNullValues,
        required: false,
        placeholder: "",
        isReadOnly: !!lock,
      }),
    ];

    if (lock) {
      const action: CustomHeaderAction = {
        icon: lock.icon,
        ariaLabel: translate("paywall.tooltip"),
        tooltip: translate("paywall.tooltip"),
        onClick: lock.openPaywall,
        alwaysVisible: true,
      };
      for (const col of cols) {
        col.meta = {
          ...col.meta,
          customHeaderActions: [action],
        };
      }
    }

    return cols;
  };
}

function customAttributeColumns(
  attributes: CustomAttribute[],
  formatting: FormattingSpec,
): GridColumn<AssetRow>[] {
  return attributes.map((attribute) => {
    const key = attribute.id;
    const columnKey: ColumnKey<AssetRow, never> = {
      id: key,
      accessorFn: ((row: AssetRow) =>
        (row as unknown as Asset).getProperty(key) ?? null) as (
        row: AssetRow,
      ) => never,
    };
    return attribute.type === "number"
      ? floatColumn(columnKey, {
          header: attribute.label,
          decimals: formatting.defaultDecimals,
          emptyValue: null,
        })
      : textColumn(columnKey, {
          header: attribute.label,
          emptyValue: null,
        });
  });
}

function _buildColumns(
  buildExtraPipeCols: ExtraPipeColsFn,
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
  validateLabel?: (label: string, row: AssetRow) => boolean,
  getRow?: (rowIndex: number) => AssetRow | undefined,
  accessorCtx?: AssetAccessorCtx,
  allowsNullValues?: boolean,
  customAttributes: CustomAttribute[] = [],
): GridColumn<AssetRow>[] {
  const ck = makeCk(type, accessorCtx);
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
    {
      unit = null,
      property,
      isReadOnly,
      placeholder,
      commitInvalidValues,
    }: {
      unit?: Parameters<TranslateUnitFn>[0];
      property?: QuantityProperty;
      isReadOnly?: (rowIndex: number) => boolean;
      placeholder?: string;
      commitInvalidValues?: boolean;
    } = {},
  ): GridColumn<AssetRow> => {
    // "diameter" is shared across types; pipe diameter is deferred from the
    // first nullable batch, so exclude it here.
    const nullable =
      isNullableColumn(key, allowsNullValues) &&
      !(key === "diameter" && type === "pipe");
    const flagOptional = !!allowsNullValues && FLAG_OPTIONAL_KEYS.has(key);
    const emptiable = isOptionalColumn(key, allowsNullValues) || nullable;
    return floatColumn(ck(key), {
      header: headerLabel(name, unit),
      decimals:
        property != null
          ? getDecimals(formatting, property)
          : formatting.defaultDecimals,
      isReadOnly: !editable.has(key) ? true : (isReadOnly ?? false),
      validate: fieldValidator(type, key),
      commitInvalidValues,
      required: !isOptionalColumn(key, allowsNullValues),
      placeholder: flagOptional
        ? (optionalColumnPlaceholder(key) ?? placeholder)
        : placeholder,
      emptyValue: emptiable ? null : NON_ZERO_KEYS.has(key) ? undefined : 0,
    });
  };

  const booleanCol = (
    key: string,
    name: string,
    isReadOnly = false,
  ): GridColumn<AssetRow> =>
    booleanColumn(ck(key), { header: name, isReadOnly });

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
  ): GridColumn<AssetRow> =>
    filterableSelectColumn(ck(key), {
      header: name,
      options: patternOpts(filterType, excludeId),
      placeholder,
      emptyOptionLabel: placeholder,
      emptyValue: null,
      isReadOnly,
    });

  const curveCol = (
    key: string,
    name: string,
    filterType: CurveType,
    placeholder?: string,
    isReadOnly?: (rowIndex: number) => boolean,
  ): GridColumn<AssetRow> =>
    filterableSelectColumn(ck(key), {
      header: name,
      options: curveOpts(filterType),
      placeholder: placeholder ?? translate("none"),
      emptyOptionLabel: placeholder ?? translate("none"),
      emptyValue: null,
      isReadOnly,
    });

  const isChemicalSourceNone = (rowIndex: number) => {
    const row = getRow?.(rowIndex);
    return row?.chemicalSourceType == null;
  };

  const chemicalSourceTypeCols = (): GridColumn<AssetRow>[] => [
    filterableSelectColumn("chemicalSourceType", {
      header: translate("chemicalSourceType"),
      options: chemicalSourceTypes.map((t) => ({
        value: t,
        label: translate(`source.${t}`),
      })),
      emptyOptionLabel: translate("none"),
      placeholder: translate("none"),
      emptyValue: null,
    }),
    numericCol("chemicalSourceStrength", translate("chemicalSourceStrength"), {
      isReadOnly: isChemicalSourceNone,
      placeholder: localizeDecimal(0),
      commitInvalidValues: allowsNullValues,
    }),
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
        ck,
        type,
        translate,
        units,
        translateUnit,
        formatting,
        qualityType,
      )
    : [];

  const trailingCols = [
    ...customAttributeColumns(customAttributes, formatting),
    ...simCols,
  ];

  switch (type) {
    case "junction":
      return [
        textColumn("label", {
          header: translate("label"),
          validate: validateLabel,
          cleanLabel: (raw) => LabelManager.sanitizeLabel(raw, type),
        }),
        booleanCol("isActive", translate("isEnabled"), true),
        numericCol("elevation", translate("elevation"), {
          unit: units.elevation,
          property: "elevation",
        }),
        numericCol("emitterCoefficient", translate("emitterCoefficient"), {
          unit: units.emitterCoefficient,
          property: "emitterCoefficient",
          commitInvalidValues: allowsNullValues,
        }),
        floatColumn(ck("avgDemand"), {
          header: headerLabel(translate("directDemand"), units.baseDemand),
          decimals: getDecimals(formatting, "baseDemand"),
          isReadOnly: true,
        }),
        integerColumn(ck("demandsCount"), {
          header: translate("demandsCount"),
          isReadOnly: true,
        }),
        floatColumn(ck("baseDemand"), {
          header: headerLabel(translate("baseDemand"), units.baseDemand),
          decimals: getDecimals(formatting, "baseDemand"),
          emptyValue: 0,
        }),
        patternCol("patternId", translate("timePattern"), "demand"),
        floatColumn(ck("customerPointCount"), {
          header: translate("connectedCustomers"),
          decimals: 0,
          isReadOnly: true,
        }),
        floatColumn(ck("avgCustomerDemand"), {
          header: headerLabel(translate("customerDemand"), units.baseDemand),
          decimals: getDecimals(formatting, "baseDemand"),
          isReadOnly: true,
        }),
        numericCol("initialQuality", translate("initialQuality"), {
          commitInvalidValues: allowsNullValues,
        }),
        ...chemicalSourceTypeCols(),
        ...trailingCols,
      ];
    case "pipe":
      return [
        textColumn("label", {
          header: translate("label"),
          validate: validateLabel,
          cleanLabel: (raw) => LabelManager.sanitizeLabel(raw, type),
        }),
        booleanCol("isActive", translate("isEnabled")),
        textColumn(ck("startNode"), {
          header: translate("startNode"),
          isReadOnly: true,
        }),
        textColumn(ck("endNode"), {
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
        numericCol("diameter", translate("diameter"), {
          unit: units.diameter,
          property: "diameter",
        }),
        numericCol("length", translate("length"), {
          unit: units.length,
          property: "length",
        }),
        ...buildExtraPipeCols(translate, formatting, allowsNullValues),
        numericCol("roughness", translate("roughness"), {
          unit: units.roughness,
          commitInvalidValues: allowsNullValues,
        }),
        numericCol("minorLoss", translate("minorLoss"), {
          unit: units.minorLoss,
          property: "minorLoss",
          commitInvalidValues: allowsNullValues,
        }),
        floatColumn(ck("customerDemand"), {
          header: headerLabel(translate("customerDemand"), units.baseDemand),
          decimals: getDecimals(formatting, "baseDemand"),
          isReadOnly: true,
        }),
        floatColumn(ck("customerPointCount"), {
          header: translate("connectedCustomers"),
          decimals: 0,
          isReadOnly: true,
        }),
        floatColumn("bulkReactionCoeff", {
          header: translate("bulkReactionCoeff"),
          decimals: formatting.defaultDecimals,
          emptyValue: null,
          placeholder: localizeDecimal(reactionGlobalBulk),
        }),
        floatColumn("wallReactionCoeff", {
          header: translate("wallReactionCoeff"),
          decimals: formatting.defaultDecimals,
          emptyValue: null,
          placeholder: localizeDecimal(reactionGlobalWall),
        }),
        ...trailingCols,
      ];
    case "pump":
      return [
        textColumn("label", {
          header: translate("label"),
          validate: validateLabel,
          cleanLabel: (raw) => LabelManager.sanitizeLabel(raw, type),
        }),
        booleanCol("isActive", translate("isEnabled")),
        textColumn(ck("startNode"), {
          header: translate("startNode"),
          isReadOnly: true,
        }),
        textColumn(ck("endNode"), {
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
        numericCol("power", translate("power"), {
          unit: units.power,
          property: "power",
          isReadOnly: (rowIndex) =>
            getRow?.(rowIndex)?.definitionType !== "power",
        }),
        numericCol("speed", translate("initialSpeed"), {
          unit: units.speed,
          property: "speed",
          commitInvalidValues: allowsNullValues,
        }),
        patternCol("speedPatternId", translate("speedPattern"), "pumpSpeed"),
        curveCol(
          "efficiencyCurveId",
          translate("efficiencyCurve"),
          "efficiency",
          translate("constantPercent", localizeDecimal(energyGlobalEfficiency)),
        ),
        numericCol("energyPrice", translate("energyPrice"), {
          placeholder: localizeDecimal(energyGlobalPrice),
          commitInvalidValues: allowsNullValues,
        }),
        patternCol(
          "energyPricePatternId",
          translate("energyPricePattern"),
          "energyPrice",
          energyPricePatternPlaceholder,
          undefined,
          energyGlobalPatternId ?? undefined,
        ),
        ...trailingCols,
      ];
    case "valve":
      return [
        textColumn("label", {
          header: translate("label"),
          validate: validateLabel,
          cleanLabel: (raw) => LabelManager.sanitizeLabel(raw, type),
        }),
        booleanCol("isActive", translate("isEnabled")),
        textColumn(ck("startNode"), {
          header: translate("startNode"),
          isReadOnly: true,
        }),
        textColumn(ck("endNode"), {
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
        numericCol("setting", translate("setting"), {
          isReadOnly: (rowIndex) => getRow?.(rowIndex)?.kind === "gpv",
          commitInvalidValues: allowsNullValues,
        }),
        filterableSelectColumn("curveId", {
          header: translate("valveCurve"),
          options: [...curveOpts("headloss"), ...curveOpts("valve")],
          placeholder: translate("none"),
          emptyOptionLabel: translate("none"),
          emptyValue: null,
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
        numericCol("diameter", translate("diameter"), {
          unit: units.diameter,
          property: "diameter",
          commitInvalidValues: allowsNullValues,
        }),
        numericCol("minorLoss", translate("minorLoss"), {
          unit: units.minorLoss,
          property: "minorLoss",
          commitInvalidValues: allowsNullValues,
        }),
        ...trailingCols,
      ];
    case "reservoir":
      return [
        textColumn("label", {
          header: translate("label"),
          validate: validateLabel,
          cleanLabel: (raw) => LabelManager.sanitizeLabel(raw, type),
        }),
        booleanCol("isActive", translate("isEnabled"), true),
        numericCol("elevation", translate("elevation"), {
          unit: units.elevation,
          property: "elevation",
        }),
        numericCol("head", translate("head"), {
          unit: units.head,
          property: "head",
          commitInvalidValues: allowsNullValues,
        }),
        patternCol("headPatternId", translate("headPattern"), "reservoirHead"),
        numericCol("initialQuality", translate("initialQuality"), {
          commitInvalidValues: allowsNullValues,
        }),
        ...chemicalSourceTypeCols(),
        ...trailingCols,
      ];
    case "tank":
      return [
        textColumn("label", {
          header: translate("label"),
          validate: validateLabel,
          cleanLabel: (raw) => LabelManager.sanitizeLabel(raw, type),
        }),
        booleanCol("isActive", translate("isEnabled"), true),
        numericCol("elevation", translate("elevation"), {
          unit: units.elevation,
          property: "elevation",
        }),
        numericCol("initialLevel", translate("initialLevel"), {
          unit: units.initialLevel,
          property: "initialLevel",
          commitInvalidValues: allowsNullValues,
        }),
        numericCol("minLevel", translate("minLevel"), {
          unit: units.minLevel,
          property: "minLevel",
          isReadOnly: (rowIndex) => getRow?.(rowIndex)?.volumeCurveId != null,
        }),
        numericCol("maxLevel", translate("maxLevel"), {
          unit: units.maxLevel,
          property: "maxLevel",
          isReadOnly: (rowIndex) => getRow?.(rowIndex)?.volumeCurveId != null,
        }),
        numericCol("minVolume", translate("minVolume"), {
          unit: units.minVolume,
          property: "minVolume",
          isReadOnly: (rowIndex) => getRow?.(rowIndex)?.volumeCurveId != null,
          commitInvalidValues: allowsNullValues,
        }),
        floatColumn(ck("maxVolume"), {
          header: headerLabel(translate("maxVolume"), units.minVolume),
          decimals: getDecimals(formatting, "minVolume"),
          isReadOnly: true,
        }),
        numericCol("diameter", translate("diameter"), {
          unit: units.tankDiameter,
          property: "tankDiameter",
          isReadOnly: (rowIndex) => getRow?.(rowIndex)?.volumeCurveId != null,
          commitInvalidValues: allowsNullValues,
        }),
        curveCol("volumeCurveId", translate("volumeCurve"), "volume"),
        booleanCol("overflow", translate("canOverflow")),
        filterableSelectColumn("mixingModel", {
          header: translate("mixingModel"),
          options: tankMixingModels.map((m) => ({
            value: m,
            label: translate(`tank.${m}`),
          })),
          emptyValue: "mixed",
        }),
        numericCol("mixingFraction", translate("mixingFraction"), {
          isReadOnly: (rowIndex) =>
            getRow?.(rowIndex)?.mixingModel !== TANK_TWO_COMPARTMENT_MIXING,
          commitInvalidValues: allowsNullValues,
        }),
        numericCol("initialQuality", translate("initialQuality"), {
          commitInvalidValues: allowsNullValues,
        }),
        floatColumn("bulkReactionCoeff", {
          header: translate("bulkReactionCoeff"),
          decimals: formatting.defaultDecimals,
          emptyValue: null,
          placeholder: localizeDecimal(reactionGlobalBulk),
        }),
        ...chemicalSourceTypeCols(),
        ...trailingCols,
      ];
  }
}

export function buildColumns(
  materials: string[],
  lock: PipeAttributesLock | undefined,
  ...args: BuildColumnsArgs
): GridColumn<AssetRow>[] {
  return _buildColumns(pipeAttributeColsFor(materials, lock), ...args);
}
