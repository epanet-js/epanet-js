import {
  HydraulicModel,
  LinkAsset,
  NodeAsset,
  Junction,
  Pipe,
  Reservoir,
  Pump,
  Tank,
  PatternId,
  HeadlossFormula,
} from "src/hydraulic-model";
import type {
  Timing,
  SimulationSettings,
} from "src/simulation/simulation-settings";
import {
  defaultHydraulicsValues,
  defaultWaterQualityValues,
  defaultEnergyValues,
} from "src/simulation/simulation-settings";
import {
  getActiveCustomerPoints,
  Valve,
  AssetId,
  CurveId,
  ICurve,
  PumpStatus,
  DEFAULT_MINOR_LOSS,
  DEFAULT_EMITTER_COEFFICIENT,
  DEFAULT_MIN_VOLUME,
  DEFAULT_MIXING_FRACTION,
  DEFAULT_SPEED,
  DEFAULT_INITIAL_QUALITY,
} from "@epanet-js/hydraulic-model";
import {
  type Projection,
  createProjectionMapper,
  getBackdropUnits,
} from "src/lib/projections";
import { UnitsSpec } from "src/lib/project-settings/quantities-spec";
import { Position } from "geojson";
import { withDebugInstrumentation } from "src/infra/with-instrumentation";
import {
  formatSimpleControl,
  formatRuleBasedControl,
  IdResolver,
  AssetReference,
} from "@epanet-js/hydraulic-model";
import {
  Pattern,
  Patterns,
  getCustomerPointDemands,
  getJunctionDemands,
} from "src/hydraulic-model";

type SimulationPipeStatus = "Open" | "Closed" | "CV";
type SimulationPumpStatus = "Open" | "Closed";
type SimulationValveStatus = "Open" | "Closed";
type EpanetValveType = "TCV" | "PRV" | "PSV" | "PBV" | "FCV" | "GPV" | "PCV";

const MISSING_VALUE = "MISSING";

import type { EpanetUnitSystem } from "@epanet-js/project-settings";
export type { EpanetUnitSystem };

export const defaultAccuracy = 0.001;
export const defaultUnbalanced = "CONTINUE 10";
export const defaultCustomersPatternId = "epanetjs_customers";

const buildUnbalancedValue = (
  settings: SimulationSettings,
): string | undefined => {
  if (settings.unbalancedMode === undefined) return undefined;
  if (settings.unbalancedMode === "STOP") return "STOP";
  if (settings.unbalancedExtraTrials && settings.unbalancedExtraTrials > 0) {
    return `CONTINUE ${settings.unbalancedExtraTrials}`;
  }
  return "CONTINUE";
};

const buildQualityValue = (
  settings: SimulationSettings,
  hydraulicModel: HydraulicModel,
  idMap: EpanetIds,
): string => {
  const type = settings.qualitySimulationType;
  if (type === "none") return "NONE";
  if (type === "age") return "AGE";
  if (type === "trace") {
    const nodeId = settings.qualityTraceNodeId;
    if (nodeId === null) return "TRACE";
    const node = hydraulicModel.assets.get(nodeId);
    if (!node || !node.isNode) return "TRACE";
    return `TRACE ${idMap.nodeId(node as NodeAsset)}`;
  }
  // chemical
  const name = settings.qualityChemicalName;
  return name ? `${name} ${settings.qualityMassUnit}` : "CHEMICAL";
};

const globalReactionRows = (settings: SimulationSettings): string[] => {
  const dq = defaultWaterQualityValues;
  const lines: string[] = [];
  if (settings.reactionBulkOrder !== dq.reactionBulkOrder)
    lines.push(`Order Bulk\t${settings.reactionBulkOrder}`);
  if (settings.reactionWallOrder !== dq.reactionWallOrder)
    lines.push(`Order Wall\t${settings.reactionWallOrder}`);
  if (settings.reactionTankOrder !== dq.reactionTankOrder)
    lines.push(`Order Tank\t${settings.reactionTankOrder}`);
  if (settings.reactionGlobalBulk !== dq.reactionGlobalBulk)
    lines.push(`Global Bulk\t${settings.reactionGlobalBulk}`);
  if (settings.reactionGlobalWall !== dq.reactionGlobalWall)
    lines.push(`Global Wall\t${settings.reactionGlobalWall}`);
  if (settings.reactionLimitingPotential !== dq.reactionLimitingPotential)
    lines.push(`Limiting Potential\t${settings.reactionLimitingPotential}`);
  if (settings.reactionRoughnessCorrelation !== dq.reactionRoughnessCorrelation)
    lines.push(
      `Roughness Correlation\t${settings.reactionRoughnessCorrelation}`,
    );
  return lines;
};

const globalEnergyRows = (
  settings: SimulationSettings,
  idMap: EpanetIds,
): string[] => {
  const de = defaultEnergyValues;
  const lines: string[] = [];
  if (settings.energyGlobalEfficiency !== de.energyGlobalEfficiency) {
    lines.push(`Global Effic\t${settings.energyGlobalEfficiency}`);
  }
  if (settings.energyGlobalPrice !== de.energyGlobalPrice)
    lines.push(`Global Price\t${settings.energyGlobalPrice}`);
  if (settings.energyGlobalPatternId !== null) {
    lines.push(
      `Global Pattern\t${idMap.patternId(settings.energyGlobalPatternId)}`,
    );
  }
  if (settings.energyDemandCharge !== de.energyDemandCharge)
    lines.push(`Demand Charge\t${settings.energyDemandCharge}`);
  return lines;
};

const defaultConstantPatternId = 0;

const formatSecondsToTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (secs > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  if (minutes > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}`;
  }
  return `${hours}`;
};

const buildTimesSection = (timing: Timing): string[] => {
  const section = ["[TIMES]"];

  section.push(`Duration\t${formatSecondsToTime(timing.duration)}`);

  if (timing.duration > 0) {
    section.push(
      `Hydraulic Timestep\t${formatSecondsToTime(timing.hydraulicTimestep)}`,
    );
    section.push(
      `Report Timestep\t${formatSecondsToTime(timing.reportTimestep)}`,
    );
    section.push(
      `Pattern Timestep\t${formatSecondsToTime(timing.patternTimestep)}`,
    );
    if (timing.qualityTimestep) {
      section.push(
        `Quality Timestep\t${formatSecondsToTime(timing.qualityTimestep)}`,
      );
    }
    if (timing.ruleTimestep) {
      section.push(
        `Rule Timestep\t${formatSecondsToTime(timing.ruleTimestep)}`,
      );
    }
  }

  return section;
};

export const chooseUnitSystem = (units: UnitsSpec): EpanetUnitSystem => {
  const flowUnit = units.flow;
  if (flowUnit === "l/s") return "LPS";
  if (flowUnit === "gal/min") return "GPM";
  if (flowUnit === "ft^3/s") return "CFS";
  if (flowUnit === "l/min") return "LPM";
  if (flowUnit === "Mgal/d") return "MGD";
  if (flowUnit === "IMgal/d") return "IMGD";
  if (flowUnit === "Ml/d") return "MLD";
  if (flowUnit === "m^3/h") return "CMH";
  if (flowUnit === "acft/d") return "AFD";
  if (flowUnit === "m^3/d") return "CMD";

  throw new Error(`Flow unit not supported ${flowUnit}`);
};

const unitToEpanetPressure: Record<string, string> = {
  psi: "PSI",
  kPa: "KPA",
  mwc: "METERS",
  fwc: "FEET",
  bar: "BAR",
};

const US_UNIT_SYSTEMS: EpanetUnitSystem[] = [
  "GPM",
  "CFS",
  "MGD",
  "IMGD",
  "AFD",
];

export const isUsUnitSystem = (unitSystem: EpanetUnitSystem): boolean =>
  US_UNIT_SYSTEMS.includes(unitSystem);

const isDefaultPressureForSystem = (
  unitSystem: EpanetUnitSystem,
  pressureUnit: string,
): boolean => {
  if (US_UNIT_SYSTEMS.includes(unitSystem)) return pressureUnit === "psi";
  return pressureUnit === "mwc";
};

const EPANET_MAX_LABEL_LENGTH = 31;

// EPANET delimits INP tokens on whitespace and treats `;` as a comment; the
// EPANET desktop UI additionally mis-parses commas and double quotes inside an
// ID. Strip these on export so labels are portable to any EPANET consumer.
// Applied only when writing the INP — commas stay fully supported in-app.
const EPANET_UNSAFE_ID_CHARS = /[\s;,"]/g;

const toSafeEpanetId = (label: string, fallbackId: string): string => {
  const safe = label.replace(EPANET_UNSAFE_ID_CHARS, "");
  return safe.length > 0 ? safe : fallbackId;
};

class EpanetIds {
  private strategy: "id" | "label";
  private maxLabelLength?: number;
  private sanitizeLabels: boolean;
  private assetIds: Map<AssetId, string>;
  private linkIds: Set<string>;
  private nodeIds: Set<string>;
  private patternIds: Map<PatternId, string>;
  private patternLabels: Set<string>;
  private curveIds: Map<CurveId, string>;
  private curveLabels: Set<string>;

  constructor({
    strategy,
    maxLabelLength,
    sanitizeLabels = false,
  }: {
    strategy: "id" | "label";
    maxLabelLength?: number;
    sanitizeLabels?: boolean;
  }) {
    this.strategy = strategy;
    this.maxLabelLength = maxLabelLength;
    this.sanitizeLabels = sanitizeLabels;
    this.nodeIds = new Set();
    this.linkIds = new Set();
    this.assetIds = new Map();
    this.patternIds = new Map();
    this.patternLabels = new Set();
    this.curveIds = new Map();
    this.curveLabels = new Set();
  }

  linkId(link: LinkAsset) {
    switch (this.strategy) {
      case "id":
        return String(link.id);
      case "label":
        if (this.assetIds.has(link.id)) return this.assetIds.get(link.id)!;
        const id = this.ensureUnique(
          this.linkIds,
          this.safeLabel(link.label, String(link.id)),
        );
        this.linkIds.add(id);
        this.assetIds.set(link.id, id);
        return id;
    }
  }

  nodeId(node: NodeAsset) {
    switch (this.strategy) {
      case "id":
        return String(node.id);
      case "label":
        if (this.assetIds.has(node.id)) return this.assetIds.get(node.id)!;
        const id = this.ensureUnique(
          this.nodeIds,
          this.safeLabel(node.label, String(node.id)),
        );
        this.nodeIds.add(id);
        this.assetIds.set(node.id, id);
        return id;
    }
  }

  registerCurveId(curve: Pick<ICurve, "id" | "label">) {
    if (this.curveIds.has(curve.id)) return this.curveIds.get(curve.id);
    const label = this.ensureUnique(
      this.curveLabels,
      this.safeLabel(curve.label, String(curve.id)),
    );
    this.curveLabels.add(label);
    this.curveIds.set(curve.id, label);
    return label;
  }

  curveId(curveId: CurveId): string {
    return this.curveIds.get(curveId) ?? "*";
  }

  localCurveId(candidate: string, fallbackId: string) {
    const label = this.ensureUnique(
      this.curveLabels,
      this.safeLabel(candidate, fallbackId),
    );
    this.curveLabels.add(label);
    return label;
  }

  registerPatternId(pattern: Pick<Pattern, "id" | "label">) {
    if (this.patternIds.has(pattern.id))
      return this.patternIds.get(pattern.id)!;
    const label = this.ensureUnique(
      this.patternLabels,
      this.safeLabel(pattern.label, String(pattern.id)),
    );
    this.patternLabels.add(label);
    this.patternIds.set(pattern.id, label);
    return label;
  }

  patternId(patternId: PatternId): string {
    return this.patternIds.get(patternId) ?? "*";
  }

  private safeLabel(label: string, fallbackId: string): string {
    return this.sanitizeLabels ? toSafeEpanetId(label, fallbackId) : label;
  }

  private ensureUnique(
    takenIds: Set<string>,
    candidate: string,
    count = 0,
  ): string {
    const suffix = count > 0 ? `.${count}` : "";
    const newCandidate = this.fitToLimit(candidate, suffix);
    if (!takenIds.has(newCandidate)) {
      return newCandidate;
    } else {
      return this.ensureUnique(takenIds, candidate, count + 1);
    }
  }

  private fitToLimit(candidate: string, suffix: string): string {
    if (this.maxLabelLength === undefined) return `${candidate}${suffix}`;
    const reserve = suffix.length === 0 ? 0 : Math.max(3, suffix.length);
    const base = candidate.slice(0, this.maxLabelLength - reserve);
    return `${base}${suffix}`;
  }
}

type BuildOptions = {
  simulationSettings: SimulationSettings;
  units: UnitsSpec;
  headlossFormula?: HeadlossFormula;
  geolocation?: boolean;
  madeBy?: boolean;
  labelIds?: boolean;
  enforceLabelLimit?: boolean;
  customerDemands?: boolean;
  usedPatterns?: boolean;
  usedCurves?: boolean;
  includeQuality?: boolean;
  projection?: Projection;
  excludeInactiveControls?: boolean;
};

export const buildInp = withDebugInstrumentation(
  (hydraulicModel: HydraulicModel, options: BuildOptions): string => {
    let contents = "";
    for (const chunk of generateInp(hydraulicModel, options)) {
      contents += chunk;
    }
    return contents;
  },
  { name: "BUILD_INP", maxDurationMs: 1000 },
);

const FILE_WRITE_BUFFER_SIZE = 64 * 1024;

export const buildInpToFile = withDebugInstrumentation(
  async (
    file: FileSystemWritableFileStream,
    hydraulicModel: HydraulicModel,
    options: BuildOptions,
  ): Promise<void> => {
    let buffer = "";
    for (const chunk of generateInp(hydraulicModel, options)) {
      buffer += chunk;
      if (buffer.length >= FILE_WRITE_BUFFER_SIZE) {
        await file.write(buffer);
        buffer = "";
      }
    }
    if (buffer.length > 0) {
      await file.write(buffer);
    }
  },
  { name: "BUILD_INP_TO_FILE", maxDurationMs: 1000 },
);

type ResolvedBuildOptions = BuildOptions &
  Required<
    Pick<
      BuildOptions,
      | "headlossFormula"
      | "geolocation"
      | "madeBy"
      | "labelIds"
      | "enforceLabelLimit"
      | "customerDemands"
      | "usedPatterns"
      | "usedCurves"
      | "includeQuality"
      | "excludeInactiveControls"
    >
  >;

type PumpLocalCurveId = (pump: Pump, linkId: string) => string;

function* generateInp(
  hydraulicModel: HydraulicModel,
  options: BuildOptions,
): Generator<string> {
  const opts: ResolvedBuildOptions = {
    headlossFormula: "H-W" as HeadlossFormula,
    geolocation: false,
    madeBy: false,
    labelIds: false,
    enforceLabelLimit: false,
    customerDemands: false,
    usedPatterns: false,
    usedCurves: false,
    includeQuality: false,
    excludeInactiveControls: false,
    ...options,
  };
  const idMap = new EpanetIds({
    strategy: opts.labelIds ? "label" : "id",
    maxLabelLength: opts.enforceLabelLimit
      ? EPANET_MAX_LABEL_LENGTH
      : undefined,
    sanitizeLabels: opts.enforceLabelLimit,
  });
  const units = chooseUnitSystem(opts.units);
  const headlossFormula = opts.headlossFormula;

  const transformCoord: (p: Position) => Position = opts.projection
    ? createProjectionMapper(opts.projection).toSource
    : (p: Position) => p;

  idMap.registerPatternId({
    id: defaultConstantPatternId,
    label: "constant",
  });

  for (const pattern of hydraulicModel.patterns.values()) {
    idMap.registerPatternId(pattern);
  }

  for (const curve of hydraulicModel.curves.values()) {
    idMap.registerCurveId(curve);
  }

  // Pattern and curve usage is contributed by sections written after
  // [PATTERNS]/[CURVES] (sources, energy), so it must be collected up front.
  const { usedPatternIds, usedCurveIds } =
    opts.usedPatterns || opts.usedCurves
      ? collectUsedIds(hydraulicModel, opts)
      : { usedPatternIds: new Set<number>(), usedCurveIds: new Set<number>() };

  const pumpLocalCurveIds = new Map<AssetId, string>();
  const pumpLocalCurveId: PumpLocalCurveId = (pump, linkId) => {
    let id = pumpLocalCurveIds.get(pump.id);
    if (id === undefined) {
      id = idMap.localCurveId(pump.label, linkId);
      pumpLocalCurveIds.set(pump.id, id);
    }
    return id;
  };

  const isEps = opts.simulationSettings.timing.duration > 0;

  const state: EmitState = { atFileStart: true };

  if (opts.madeBy) {
    yield ";MADE BY EPANET-JS\n";
  }

  yield* emitSection(
    state,
    ["[JUNCTIONS]", ";Id\tElevation"],
    junctionRows(hydraulicModel, idMap),
    { alwaysWrite: true },
  );
  yield* emitSection(
    state,
    ["[RESERVOIRS]", ";Id\tHead\tPattern"],
    reservoirRows(hydraulicModel, idMap),
    { alwaysWrite: true },
  );
  yield* emitSection(
    state,
    [
      "[TANKS]",
      ";Id\tElevation\tInitLevel\tMinLevel\tMaxLevel\tDiameter\tMinVol",
    ],
    tankRows(hydraulicModel, idMap, isEps),
    { alwaysWrite: true },
  );
  yield* emitSection(
    state,
    [
      "[PIPES]",
      ";Id\tStart\tEnd\tLength\tDiameter\tRoughness\tMinorLoss\tStatus",
    ],
    pipeRows(hydraulicModel, idMap),
    { alwaysWrite: true },
  );
  yield* emitSection(
    state,
    ["[PUMPS]", ";Id\tStart\tEnd\tProperties"],
    pumpRows(hydraulicModel, idMap, pumpLocalCurveId),
    { alwaysWrite: true },
  );
  yield* emitSection(
    state,
    ["[VALVES]", ";Id\tStart\tEnd\tDiameter\tSetting\tMinorLoss"],
    valveRows(hydraulicModel, idMap),
    { alwaysWrite: true },
  );
  yield* emitSection(
    state,
    ["[DEMANDS]", ";Id\tDemand\tPattern\tCategory"],
    demandRows(hydraulicModel, idMap, opts.customerDemands),
    { alwaysWrite: true },
  );
  yield* emitSection(
    state,
    ["[EMITTERS]", ";Junction\tCoefficient"],
    emitterRows(hydraulicModel, idMap),
  );
  yield* emitSection(
    state,
    ["[STATUS]", ";Id\tStatus"],
    statusRows(hydraulicModel, idMap),
    { alwaysWrite: true },
  );
  yield* emitSection(
    state,
    ["[CURVES]", ";Id\tX\tY"],
    curveRows(
      hydraulicModel,
      idMap,
      usedCurveIds,
      opts.usedCurves,
      pumpLocalCurveId,
    ),
    { alwaysWrite: true },
  );
  yield* emitSection(
    state,
    ["[PATTERNS]", ";Id\tMultiplier"],
    patternRows(
      hydraulicModel.patterns,
      idMap,
      usedPatternIds,
      opts.usedPatterns,
    ),
    { alwaysWrite: true },
  );
  yield* emitSection(
    state,
    buildTimesSection(opts.simulationSettings.timing),
    [],
    { alwaysWrite: true },
  );
  yield* emitSection(
    state,
    [
      "[REPORT]",
      `Status\t${opts.simulationSettings.statusReport}`,
      "Summary\tNo",
      "Page\t0",
      ...(opts.simulationSettings.reportEnergy ? ["Energy\tYES"] : []),
    ],
    [],
    { alwaysWrite: true },
  );
  yield* emitSection(
    state,
    [
      "[OPTIONS]",
      `Quality\t${buildQualityValue(opts.simulationSettings, hydraulicModel, idMap)}`,
      `Unbalanced\t${buildUnbalancedValue(opts.simulationSettings) ?? defaultUnbalanced}`,
      `Accuracy\t${opts.simulationSettings.accuracy ?? defaultAccuracy}`,
      `Units\t${units}`,
      ...(!isDefaultPressureForSystem(units, opts.units.pressure as string)
        ? [`Pressure\t${unitToEpanetPressure[opts.units.pressure as string]}`]
        : []),
      `Headloss\t${headlossFormula}`,
      `Demand Multiplier\t${opts.simulationSettings.globalDemandMultiplier}`,
      `Demand Model\t${opts.simulationSettings.demandModel}`,
      ...(opts.simulationSettings.demandModel === "PDA"
        ? [
            `Minimum Pressure\t${opts.simulationSettings.minimumPressure}`,
            `Required Pressure\t${opts.simulationSettings.requiredPressure}`,
            `Pressure Exponent\t${opts.simulationSettings.pressureExponent}`,
          ]
        : []),
      `Emitter Exponent\t${opts.simulationSettings.emitterExponent}`,
      ...(!opts.simulationSettings.backflowAllowed
        ? [`Backflow Allowed\tNO`]
        : []),
      ...(opts.simulationSettings.trials !== undefined
        ? [`Trials\t${opts.simulationSettings.trials}`]
        : []),
      ...(opts.simulationSettings.headError !== undefined &&
      opts.simulationSettings.headError !== defaultHydraulicsValues.headError
        ? [`Headerror\t${opts.simulationSettings.headError}`]
        : []),
      ...(opts.simulationSettings.flowChange !== undefined &&
      opts.simulationSettings.flowChange !== defaultHydraulicsValues.flowChange
        ? [`Flowchange\t${opts.simulationSettings.flowChange}`]
        : []),
      ...(opts.simulationSettings.checkFreq !== undefined &&
      opts.simulationSettings.checkFreq !== defaultHydraulicsValues.checkFreq
        ? [`Checkfreq\t${opts.simulationSettings.checkFreq}`]
        : []),
      ...(opts.simulationSettings.maxCheck !== undefined &&
      opts.simulationSettings.maxCheck !== defaultHydraulicsValues.maxCheck
        ? [`Maxcheck\t${opts.simulationSettings.maxCheck}`]
        : []),
      ...(opts.simulationSettings.dampLimit !== undefined &&
      opts.simulationSettings.dampLimit !== defaultHydraulicsValues.dampLimit
        ? [`Damplimit\t${opts.simulationSettings.dampLimit}`]
        : []),
      ...(opts.simulationSettings.viscosity !== undefined &&
      opts.simulationSettings.viscosity !== defaultHydraulicsValues.viscosity
        ? [`Viscosity\t${opts.simulationSettings.viscosity}`]
        : []),
      ...(opts.simulationSettings.specificGravity !== undefined &&
      opts.simulationSettings.specificGravity !==
        defaultHydraulicsValues.specificGravity
        ? [`Specific Gravity\t${opts.simulationSettings.specificGravity}`]
        : []),
      ...(opts.simulationSettings.tolerance !==
      defaultWaterQualityValues.tolerance
        ? [`Tolerance\t${opts.simulationSettings.tolerance}`]
        : []),
      ...(opts.simulationSettings.diffusivity !==
      defaultWaterQualityValues.diffusivity
        ? [`Diffusivity\t${opts.simulationSettings.diffusivity}`]
        : []),
      `Pattern\t${idMap.registerPatternId({ id: defaultConstantPatternId, label: "constant" })}`,
    ],
    [],
    { alwaysWrite: true },
  );
  if (opts.includeQuality) {
    yield* emitSection(
      state,
      ["[QUALITY]", ";Node\tInitialQuality"],
      qualityRows(hydraulicModel, idMap),
    );
    yield* emitSection(
      state,
      ["[MIXING]", ";Tank\tModel\tFraction"],
      mixingRows(hydraulicModel, idMap),
    );
    yield* emitSection(
      state,
      ["[SOURCES]", ";Node\tType\tStrength\tPattern"],
      sourceRows(hydraulicModel, idMap),
    );
  }
  yield* emitSection(
    state,
    ["[REACTIONS]"],
    reactionRows(
      hydraulicModel,
      idMap,
      opts.simulationSettings,
      opts.includeQuality,
    ),
  );
  yield* emitSection(
    state,
    ["[ENERGY]"],
    energyRows(hydraulicModel, idMap, opts.simulationSettings),
  );
  if (opts.geolocation) {
    yield* emitSection(
      state,
      [
        "[BACKDROP]",
        `Units\t${opts.projection ? getBackdropUnits(opts.projection) : "DEGREES"}`,
      ],
      [],
      { alwaysWrite: true },
    );
    yield* emitSection(
      state,
      ["[COORDINATES]", ";Node\tX-coord\tY-coord"],
      coordinateRows(hydraulicModel, idMap, transformCoord),
      { alwaysWrite: true },
    );
    yield* emitSection(
      state,
      ["[VERTICES]", ";link\tX-coord\tY-coord"],
      vertexRows(hydraulicModel, idMap, transformCoord),
      { alwaysWrite: true },
    );
  }
  yield* emitSection(
    state,
    ["[CONTROLS]"],
    controlRows(hydraulicModel, idMap, opts.excludeInactiveControls),
  );
  yield* emitSection(
    state,
    ["[RULES]"],
    ruleRows(hydraulicModel, idMap, opts.excludeInactiveControls),
  );
  yield* emitSection(state, ["[END]"], [], { alwaysWrite: true });
}

type EmitState = { atFileStart: boolean };

const lineChunk = (
  state: EmitState,
  line: string,
  startsSection: boolean,
): string => {
  if (state.atFileStart) {
    state.atFileStart = false;
    return line;
  }
  return startsSection ? "\n\n" + line : "\n" + line;
};

function* emitHeader(
  state: EmitState,
  headerLines: string[],
): Generator<string> {
  for (let i = 0; i < headerLines.length; i++) {
    yield lineChunk(state, headerLines[i], i === 0);
  }
}

function* emitSection(
  state: EmitState,
  headerLines: string[],
  rows: Iterable<string>,
  { alwaysWrite = false }: { alwaysWrite?: boolean } = {},
): Generator<string> {
  let headerWritten = false;
  for (const row of rows) {
    if (!headerWritten) {
      yield* emitHeader(state, headerLines);
      headerWritten = true;
    }
    yield lineChunk(state, row, false);
  }
  if (alwaysWrite && !headerWritten) {
    yield* emitHeader(state, headerLines);
  }
}

const collectUsedIds = (
  hydraulicModel: HydraulicModel,
  opts: ResolvedBuildOptions,
): { usedPatternIds: Set<number>; usedCurveIds: Set<number> } => {
  const usedPatternIds = new Set<number>();
  const usedCurveIds = new Set<number>();

  if (opts.simulationSettings.energyGlobalPatternId !== null) {
    usedPatternIds.add(opts.simulationSettings.energyGlobalPatternId);
  }

  const collectSourcePattern = (node: NodeAsset) => {
    if (!opts.includeQuality) return;
    const typedNode = node as Junction | Tank | Reservoir;
    if (!typedNode.chemicalSourceType) return;
    if (typedNode.chemicalSourcePatternId) {
      usedPatternIds.add(typedNode.chemicalSourcePatternId);
    }
  };

  for (const asset of hydraulicModel.assets.values()) {
    if (asset.type === "reservoir") {
      const reservoir = asset as Reservoir;
      if (reservoir.isActive && reservoir.headPatternId) {
        usedPatternIds.add(reservoir.headPatternId);
      }
      collectSourcePattern(reservoir);
    }

    if (asset.type === "tank") {
      const tank = asset as Tank;
      if (tank.isActive && tank.volumeCurveId) {
        usedCurveIds.add(tank.volumeCurveId);
      }
      collectSourcePattern(tank);
    }

    if (asset.type === "junction") {
      const junction = asset as Junction;
      if (junction.isActive) {
        for (const demand of getJunctionDemands(
          hydraulicModel.demands,
          junction.id,
        )) {
          if (demand.baseDemand === 0 || !demand.patternId) continue;
          usedPatternIds.add(demand.patternId);
        }
        if (opts.customerDemands) {
          const customerPoints = getActiveCustomerPoints(
            hydraulicModel.customerPointsLookup,
            hydraulicModel.assets,
            junction.id,
          );
          for (const cp of customerPoints) {
            for (const demand of getCustomerPointDemands(
              hydraulicModel.demands,
              cp.id,
            )) {
              if (demand.baseDemand === 0 || !demand.patternId) continue;
              usedPatternIds.add(demand.patternId);
            }
          }
        }
      }
      collectSourcePattern(junction);
    }

    if (asset.type === "pump") {
      const pump = asset as Pump;
      if (pump.isActive) {
        if (pump.speedPatternId) usedPatternIds.add(pump.speedPatternId);
        if (pump.definitionType === "curveId" && pump.curveId) {
          usedCurveIds.add(pump.curveId);
        }
        if (pump.efficiencyCurveId) usedCurveIds.add(pump.efficiencyCurveId);
        if (pump.energyPricePatternId) {
          usedPatternIds.add(pump.energyPricePatternId);
        }
      }
    }

    if (asset.type === "valve") {
      const valve = asset as Valve;
      if (valve.isActive && valve.curveId) usedCurveIds.add(valve.curveId);
    }
  }

  return { usedPatternIds, usedCurveIds };
};

function* junctionRows(
  hydraulicModel: HydraulicModel,
  idMap: EpanetIds,
): Generator<string> {
  for (const asset of hydraulicModel.assets.values()) {
    if (asset.type !== "junction") continue;
    const junction = asset as Junction;
    if (!junction.isActive) continue;

    yield [idMap.nodeId(junction), requiredValue(junction.elevation)].join(
      "\t",
    );
  }
}

function* reservoirRows(
  hydraulicModel: HydraulicModel,
  idMap: EpanetIds,
): Generator<string> {
  for (const asset of hydraulicModel.assets.values()) {
    if (asset.type !== "reservoir") continue;
    const reservoir = asset as Reservoir;
    if (!reservoir.isActive) continue;

    const columns: (string | number)[] = [
      idMap.nodeId(reservoir),
      requiredValue(reservoir.head),
    ];
    if (reservoir.headPatternId) {
      columns.push(idMap.patternId(reservoir.headPatternId));
    }
    yield columns.join("\t");
  }
}

type TankDimension = (value: number | null) => number | string;

function* tankRows(
  hydraulicModel: HydraulicModel,
  idMap: EpanetIds,
  isEps: boolean,
): Generator<string> {
  // A steady-state snapshot ignores tank storage geometry, so a missing level
  // or diameter is coalesced to 0 to let the run proceed instead of writing
  // MISSING.
  const dimension: TankDimension = isEps
    ? requiredValue
    : (value) => optionalValue(value, 0);

  for (const asset of hydraulicModel.assets.values()) {
    if (asset.type !== "tank") continue;
    const tank = asset as Tank;
    if (!tank.isActive) continue;

    yield [
      idMap.nodeId(tank),
      requiredValue(tank.elevation),
      dimension(tank.initialLevel),
      dimension(tank.minLevel),
      dimension(tank.maxLevel),
      // Diameter is required unless a volume curve defines the geometry.
      tank.volumeCurveId ? (tank.diameter ?? 0) : dimension(tank.diameter),
      optionalValue(tank.minVolume, DEFAULT_MIN_VOLUME),
      tank.volumeCurveId ? idMap.curveId(tank.volumeCurveId) : "*",
      tank.overflow ? "YES" : "NO",
    ].join("\t");
  }
}

function* pipeRows(
  hydraulicModel: HydraulicModel,
  idMap: EpanetIds,
): Generator<string> {
  for (const asset of hydraulicModel.assets.values()) {
    if (asset.type !== "pipe") continue;
    const pipe = asset as Pipe;
    if (!pipe.isActive) continue;

    const linkId = idMap.linkId(pipe);
    const [startId, endId] = getLinkConnectionIds(hydraulicModel, idMap, pipe);

    const status = pipeStatusFor(pipe);
    const columns: (string | number)[] = [
      linkId,
      startId,
      endId,
      requiredValue(pipe.length),
      requiredValue(pipe.diameter),
      requiredValue(pipe.roughness),
    ];
    const minorLoss = optionalValue(pipe.minorLoss, DEFAULT_MINOR_LOSS);
    if (minorLoss !== DEFAULT_MINOR_LOSS || status !== "Open") {
      columns.push(minorLoss, status);
    }

    yield columns.join("\t");
  }
}

function* pumpRows(
  hydraulicModel: HydraulicModel,
  idMap: EpanetIds,
  pumpLocalCurveId: PumpLocalCurveId,
): Generator<string> {
  for (const asset of hydraulicModel.assets.values()) {
    if (asset.type !== "pump") continue;
    const pump = asset as Pump;
    if (!pump.isActive) continue;

    const linkId = idMap.linkId(pump);
    const [startId, endId] = getLinkConnectionIds(hydraulicModel, idMap, pump);

    const speedPatternParts: string[] = [];
    if (pump.speedPatternId) {
      speedPatternParts.push(`PATTERN ${idMap.patternId(pump.speedPatternId)}`);
    }
    // EPANET defaults relative speed to 1.0; omit the SPEED keyword when empty.
    const speedParts = pump.speed != null ? [`SPEED ${pump.speed}`] : [];
    switch (pump.definitionType) {
      case "power":
        yield [
          linkId,
          startId,
          endId,
          `POWER ${requiredValue(pump.power)}`,
          ...speedParts,
          ...speedPatternParts,
        ].join("\t");
        break;
      case "designPointCurve":
      case "standardCurve": {
        const curvePoints = pump.curve ?? [];
        const hasCurve = curvePoints.length > 0;
        const localCurveId = hasCurve
          ? pumpLocalCurveId(pump, linkId)
          : MISSING_VALUE;
        yield [
          linkId,
          startId,
          endId,
          `HEAD ${localCurveId}`,
          ...speedParts,
          ...speedPatternParts,
        ].join("\t");
        break;
      }
      case "curveId":
        const curveId = pump.curveId
          ? idMap.curveId(pump.curveId)
          : MISSING_VALUE;

        yield [
          linkId,
          startId,
          endId,
          `HEAD ${curveId}`,
          ...speedParts,
          ...speedPatternParts,
        ].join("\t");
    }
  }
}

function* valveRows(
  hydraulicModel: HydraulicModel,
  idMap: EpanetIds,
): Generator<string> {
  for (const asset of hydraulicModel.assets.values()) {
    if (asset.type !== "valve") continue;
    const valve = asset as Valve;
    if (!valve.isActive) continue;

    const linkId = idMap.linkId(valve);
    const valveCurveId = valve.curveId ? idMap.curveId(valve.curveId) : "";

    const valveData = [
      linkId,
      ...getLinkConnectionIds(hydraulicModel, idMap, valve),
      String(requiredValue(valve.diameter)),
      kindFor(valve),
      valve.kind === "gpv"
        ? valveCurveId
        : String(requiredValue(valve.setting)),
      String(optionalValue(valve.minorLoss, DEFAULT_MINOR_LOSS)),
    ];
    if (valve.kind === "pcv") {
      valveData.push(valveCurveId);
    }

    yield valveData.join("\t");
  }
}

function* demandRows(
  hydraulicModel: HydraulicModel,
  idMap: EpanetIds,
  customerDemands: boolean,
): Generator<string> {
  for (const asset of hydraulicModel.assets.values()) {
    if (asset.type !== "junction") continue;
    const junction = asset as Junction;
    if (!junction.isActive) continue;

    const junctionId = idMap.nodeId(junction);

    for (const demand of getJunctionDemands(
      hydraulicModel.demands,
      junction.id,
    )) {
      if (demand.baseDemand === 0) continue;

      const demandLine = demand.patternId
        ? [junctionId, demand.baseDemand, idMap.patternId(demand.patternId)]
        : [junctionId, demand.baseDemand];

      yield demandLine.join("\t");
    }

    if (customerDemands) {
      const customerPoints = getActiveCustomerPoints(
        hydraulicModel.customerPointsLookup,
        hydraulicModel.assets,
        junction.id,
      );

      const demandsByPattern = new Map<number | undefined, number>();
      for (const cp of customerPoints) {
        for (const demand of getCustomerPointDemands(
          hydraulicModel.demands,
          cp.id,
        )) {
          if (demand.baseDemand === 0) continue;
          const currentTotal = demandsByPattern.get(demand.patternId) ?? 0;
          demandsByPattern.set(
            demand.patternId,
            currentTotal + demand.baseDemand,
          );
        }
      }

      for (const [patternId, totalDemand] of demandsByPattern) {
        const demandLine = patternId
          ? [junctionId, totalDemand, idMap.patternId(patternId)]
          : [junctionId, totalDemand];

        yield demandLine.join("\t");
      }
    }
  }
}

function* emitterRows(
  hydraulicModel: HydraulicModel,
  idMap: EpanetIds,
): Generator<string> {
  for (const asset of hydraulicModel.assets.values()) {
    if (asset.type !== "junction") continue;
    const junction = asset as Junction;
    if (!junction.isActive) continue;

    if (
      junction.emitterCoefficient != null &&
      junction.emitterCoefficient > DEFAULT_EMITTER_COEFFICIENT
    ) {
      yield [idMap.nodeId(junction), junction.emitterCoefficient].join("\t");
    }
  }
}

function* statusRows(
  hydraulicModel: HydraulicModel,
  idMap: EpanetIds,
): Generator<string> {
  for (const asset of hydraulicModel.assets.values()) {
    if (asset.type === "pump") {
      const pump = asset as Pump;
      if (!pump.isActive) continue;
      yield [idMap.linkId(pump), pumpStatusFor(pump)].join("\t");
    }

    if (asset.type === "valve") {
      const valve = asset as Valve;
      if (!valve.isActive) continue;
      if (valve.initialStatus !== "active") {
        yield [idMap.linkId(valve), valveFixedStatusFor(valve)].join("\t");
      }
    }
  }
}

const CURVE_TYPE_TO_KEYWORD: Record<string, string> = {
  pump: "PUMP",
  efficiency: "EFFICIENCY",
  volume: "VOLUME",
  headloss: "HEADLOSS",
  valve: "VALVE",
};

function* curveRows(
  hydraulicModel: HydraulicModel,
  idMap: EpanetIds,
  usedCurveIds: Set<number>,
  usedCurvesOnly: boolean,
  pumpLocalCurveId: PumpLocalCurveId,
): Generator<string> {
  for (const asset of hydraulicModel.assets.values()) {
    if (asset.type !== "pump") continue;
    const pump = asset as Pump;
    if (!pump.isActive) continue;
    if (
      pump.definitionType !== "designPointCurve" &&
      pump.definitionType !== "standardCurve"
    ) {
      continue;
    }

    const curvePoints = pump.curve ?? [];
    if (curvePoints.length === 0) continue;

    const localCurveId = pumpLocalCurveId(pump, idMap.linkId(pump));
    yield ";PUMP:";
    for (const point of curvePoints) {
      yield [localCurveId, String(point.x), String(point.y)].join("\t");
    }
  }

  for (const curve of hydraulicModel.curves.values()) {
    if (usedCurvesOnly && !usedCurveIds.has(curve.id)) continue;
    const curveId = idMap.registerCurveId(curve);
    const keyword = curve.type ? CURVE_TYPE_TO_KEYWORD[curve.type] : undefined;
    if (keyword) yield `;${keyword}:`;
    for (const point of curve.points) {
      yield [curveId, String(point.x), String(point.y)].join("\t");
    }
  }
}

function* patternRows(
  patterns: Patterns,
  idMap: EpanetIds,
  usedPatternIds: Set<number>,
  usedPatternsOnly: boolean,
): Generator<string> {
  const constantPatternId = idMap.patternId(defaultConstantPatternId);
  yield [constantPatternId, "1"].join("\t");

  for (const pattern of patterns.values()) {
    const mappedId = idMap.patternId(pattern.id);
    if (usedPatternsOnly && !usedPatternIds.has(pattern.id)) continue;

    const FACTORS_PER_LINE = 8;
    for (let i = 0; i < pattern.multipliers.length; i += FACTORS_PER_LINE) {
      const chunk = pattern.multipliers.slice(i, i + FACTORS_PER_LINE);
      yield [mappedId, ...chunk.map(String)].join("\t");
    }
  }
}

function* qualityRows(
  hydraulicModel: HydraulicModel,
  idMap: EpanetIds,
): Generator<string> {
  for (const asset of hydraulicModel.assets.values()) {
    if (!asset.isNode) continue;
    const node = asset as Junction | Tank | Reservoir;
    const value = node.initialQuality;
    if (value !== undefined && value !== DEFAULT_INITIAL_QUALITY) {
      yield `${idMap.nodeId(node)}\t${value}`;
    }
  }
}

const MIXING_MODEL_TO_INP: Record<string, string> = {
  mixed: "MIXED",
  "2comp": "2COMP",
  fifo: "FIFO",
  lifo: "LIFO",
};

function* mixingRows(
  hydraulicModel: HydraulicModel,
  idMap: EpanetIds,
): Generator<string> {
  for (const asset of hydraulicModel.assets.values()) {
    if (asset.type !== "tank") continue;
    const tank = asset as Tank;
    if (tank.mixingModel === "mixed") continue;

    const model = MIXING_MODEL_TO_INP[tank.mixingModel] ?? "MIXED";
    yield tank.mixingModel === "2comp"
      ? `${idMap.nodeId(tank)}\t${model}\t${optionalValue(tank.mixingFraction, DEFAULT_MIXING_FRACTION)}`
      : `${idMap.nodeId(tank)}\t${model}`;
  }
}

function* sourceRows(
  hydraulicModel: HydraulicModel,
  idMap: EpanetIds,
): Generator<string> {
  for (const asset of hydraulicModel.assets.values()) {
    if (!asset.isNode) continue;
    const node = asset as Junction | Tank | Reservoir;
    const sourceType = node.chemicalSourceType;
    if (!sourceType) continue;

    const inpType = sourceType.toUpperCase();
    const strength = node.chemicalSourceStrength ?? 0;
    const patternId = node.chemicalSourcePatternId;
    yield patternId
      ? `${idMap.nodeId(node)}\t${inpType}\t${strength}\t${idMap.patternId(patternId)}`
      : `${idMap.nodeId(node)}\t${inpType}\t${strength}`;
  }
}

function* reactionRows(
  hydraulicModel: HydraulicModel,
  idMap: EpanetIds,
  settings: SimulationSettings,
  includeQuality: boolean,
): Generator<string, void, undefined> {
  yield* globalReactionRows(settings);

  if (!includeQuality) return;

  for (const asset of hydraulicModel.assets.values()) {
    if (asset.type === "pipe") {
      const pipe = asset as Pipe;
      if (pipe.bulkReactionCoeff !== undefined) {
        yield `Bulk\t${idMap.linkId(pipe)}\t${pipe.bulkReactionCoeff}`;
      }
      if (pipe.wallReactionCoeff !== undefined) {
        yield `Wall\t${idMap.linkId(pipe)}\t${pipe.wallReactionCoeff}`;
      }
    }

    if (asset.type === "tank") {
      const tank = asset as Tank;
      if (tank.bulkReactionCoeff !== undefined) {
        yield `Tank\t${idMap.nodeId(tank)}\t${tank.bulkReactionCoeff}`;
      }
    }
  }
}

function* energyRows(
  hydraulicModel: HydraulicModel,
  idMap: EpanetIds,
  settings: SimulationSettings,
): Generator<string, void, undefined> {
  yield* globalEnergyRows(settings, idMap);

  for (const asset of hydraulicModel.assets.values()) {
    if (asset.type !== "pump") continue;
    const pump = asset as Pump;
    if (!pump.isActive) continue;

    const linkId = idMap.linkId(pump);
    if (pump.efficiencyCurveId) {
      yield `Pump ${linkId} Efficiency\t${idMap.curveId(pump.efficiencyCurveId)}`;
    }
    if (pump.energyPrice !== undefined) {
      yield `Pump ${linkId} Price\t${pump.energyPrice}`;
    }
    if (pump.energyPricePatternId) {
      yield `Pump ${linkId} Pattern\t${idMap.patternId(pump.energyPricePatternId)}`;
    }
  }
}

function* coordinateRows(
  hydraulicModel: HydraulicModel,
  idMap: EpanetIds,
  transformCoord: (p: Position) => Position,
): Generator<string> {
  for (const asset of hydraulicModel.assets.values()) {
    if (!asset.isNode) continue;
    const node = asset as NodeAsset;
    if (!node.isActive) continue;

    const coords = transformCoord(node.coordinates);
    yield [idMap.nodeId(node), ...coords].join("\t");
  }
}

function* vertexRows(
  hydraulicModel: HydraulicModel,
  idMap: EpanetIds,
  transformCoord: (p: Position) => Position,
): Generator<string> {
  for (const asset of hydraulicModel.assets.values()) {
    if (!asset.isLink) continue;
    const link = asset as LinkAsset;
    if (!link.isActive) continue;

    for (const vertex of link.intermediateVertices) {
      const coords = transformCoord(vertex);
      yield [idMap.linkId(link), ...coords].join("\t");
    }
  }
}

function* controlRows(
  hydraulicModel: HydraulicModel,
  idMap: EpanetIds,
  excludeInactiveControls: boolean,
): Generator<string> {
  const idResolver: IdResolver = (assetId: AssetId) => {
    const asset = hydraulicModel.assets.get(assetId);
    if (!asset) {
      return String(assetId);
    }
    if (asset.isLink) {
      return idMap.linkId(asset as LinkAsset);
    } else {
      return idMap.nodeId(asset as NodeAsset);
    }
  };

  const referencesInactiveAsset = (references: AssetReference[]) =>
    references.some(
      (reference) => !isAssetInSimulation(hydraulicModel, reference.assetId),
    );

  for (const control of hydraulicModel.rawControls.simple) {
    if (
      excludeInactiveControls &&
      referencesInactiveAsset(control.assetReferences)
    ) {
      continue;
    }
    yield formatSimpleControl(control, idResolver);
  }

  yield* timedSettingControlRows(
    hydraulicModel,
    idMap,
    excludeInactiveControls,
  );
  yield* levelSettingControlRows(
    hydraulicModel,
    idMap,
    excludeInactiveControls,
  );
}

function* timedSettingControlRows(
  hydraulicModel: HydraulicModel,
  idMap: EpanetIds,
  excludeInactiveControls: boolean,
): Generator<string> {
  for (const control of hydraulicModel.controls) {
    if (control.type !== "timed-setting") continue;
    if (
      excludeInactiveControls &&
      !isAssetInSimulation(hydraulicModel, control.linkId)
    ) {
      continue;
    }

    const linkId = resolveLinkId(hydraulicModel, idMap, control.linkId);
    for (const step of control.steps) {
      const setting = pumpSettingFor(step.status, step.setting);
      const settingText =
        typeof setting === "number" ? String(setting) : setting.toUpperCase();
      yield `LINK ${linkId} ${settingText} AT TIME ${formatSecondsToTime(step.time)}`;
    }
  }
}

function* levelSettingControlRows(
  hydraulicModel: HydraulicModel,
  idMap: EpanetIds,
  excludeInactiveControls: boolean,
): Generator<string> {
  for (const control of hydraulicModel.controls) {
    if (control.type !== "level-setting") continue;
    if (
      excludeInactiveControls &&
      (!isAssetInSimulation(hydraulicModel, control.linkId) ||
        !isAssetInSimulation(hydraulicModel, control.tankId))
    ) {
      continue;
    }

    const linkId = resolveLinkId(hydraulicModel, idMap, control.linkId);
    const tankId = resolveNodeId(hydraulicModel, idMap, control.tankId);

    const onSetting = pumpSettingFor("on", control.on.setting);
    const onSettingText =
      typeof onSetting === "number"
        ? String(onSetting)
        : onSetting.toUpperCase();

    yield `LINK ${linkId} ${onSettingText} IF NODE ${tankId} BELOW ${control.on.level}`;
    yield `LINK ${linkId} CLOSED IF NODE ${tankId} ABOVE ${control.off.level}`;
  }
}

function* ruleRows(
  hydraulicModel: HydraulicModel,
  idMap: EpanetIds,
  excludeInactiveControls: boolean,
): Generator<string> {
  const idResolver: IdResolver = (assetId: AssetId) => {
    const asset = hydraulicModel.assets.get(assetId);
    if (!asset) {
      return String(assetId);
    }
    if (asset.isLink) {
      return idMap.linkId(asset as LinkAsset);
    } else {
      return idMap.nodeId(asset as NodeAsset);
    }
  };

  const referencesInactiveAsset = (references: AssetReference[]) =>
    references.some(
      (reference) => !isAssetInSimulation(hydraulicModel, reference.assetId),
    );

  for (const rule of hydraulicModel.rawControls.rules) {
    if (
      excludeInactiveControls &&
      referencesInactiveAsset(rule.assetReferences)
    ) {
      continue;
    }
    yield formatRuleBasedControl(rule, idResolver);
  }
}

const resolveLinkId = (
  hydraulicModel: HydraulicModel,
  idMap: EpanetIds,
  linkId: AssetId,
): string => {
  const asset = hydraulicModel.assets.get(linkId);
  if (!asset) return String(linkId);
  return idMap.linkId(asset as LinkAsset);
};

const resolveNodeId = (
  hydraulicModel: HydraulicModel,
  idMap: EpanetIds,
  nodeId: AssetId,
): string => {
  const asset = hydraulicModel.assets.get(nodeId);
  if (!asset) return String(nodeId);
  return idMap.nodeId(asset as NodeAsset);
};

const getLinkConnectionIds = (
  hydraulicModel: HydraulicModel,
  idMap: EpanetIds,
  link: LinkAsset,
) => {
  const [nodeStart, nodeEnd] = link.connections;

  const startNode = hydraulicModel.assets.get(nodeStart);
  const endNode = hydraulicModel.assets.get(nodeEnd);

  const startNodeId =
    startNode?.isNode === true
      ? idMap.nodeId(startNode as NodeAsset)
      : MISSING_VALUE;
  const endNodeId =
    endNode?.isNode === true
      ? idMap.nodeId(endNode as NodeAsset)
      : MISSING_VALUE;

  return [startNodeId, endNodeId];
};

const pipeStatusFor = (pipe: Pipe): SimulationPipeStatus => {
  switch (pipe.initialStatus) {
    case "open":
      return "Open";
    case "closed":
      return "Closed";
    case "cv":
      return "CV";
  }
};

const pumpSettingFor = (
  status: PumpStatus,
  speed: number,
): SimulationPumpStatus | number => {
  if (status === "off" || speed === 0) return "Closed";

  if (speed !== 1) return speed;

  return "Open";
};

const pumpStatusFor = (pump: Pump): SimulationPumpStatus | number =>
  pumpSettingFor(pump.initialStatus, optionalValue(pump.speed, DEFAULT_SPEED));

const valveFixedStatusFor = (valve: Valve): SimulationValveStatus => {
  switch (valve.initialStatus) {
    case "open":
      return "Open";
    case "closed":
      return "Closed";
    case "active":
      throw new Error("Cannot force valve to active");
  }
};

const kindFor = (valve: Valve): EpanetValveType => {
  return valve.kind.toUpperCase() as EpanetValveType;
};

const isAssetInSimulation = (
  hydraulicModel: HydraulicModel,
  assetId: AssetId,
): boolean => {
  const asset = hydraulicModel.assets.get(assetId);
  return !!asset && asset.isActive;
};

const requiredValue = <T>(value: T | undefined | null): T | string =>
  value == null ? MISSING_VALUE : value;

const optionalValue = <T>(value: T | undefined | null, fallback: T): T =>
  value == null ? fallback : value;
