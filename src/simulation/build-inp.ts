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
  Demands,
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
  CustomerPoint,
  getActiveCustomerPoints,
} from "src/hydraulic-model/customer-points";
import { CustomerPointsLookup } from "src/hydraulic-model/customer-points-lookup";
import { Valve, AssetId } from "src/hydraulic-model/asset-types";
import { checksum } from "src/infra/checksum";
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
} from "src/hydraulic-model/controls";
import {
  Pattern,
  Patterns,
  getCustomerPointDemands,
  getJunctionDemands,
} from "src/hydraulic-model";
import { CurveId, ICurve } from "src/hydraulic-model/curves";

type SimulationPipeStatus = "Open" | "Closed" | "CV";
type SimulationPumpStatus = "Open" | "Closed";
type SimulationValveStatus = "Open" | "Closed";
type EpanetValveType = "TCV" | "PRV" | "PSV" | "PBV" | "FCV" | "GPV" | "PCV";

export type EpanetUnitSystem =
  | "LPS"
  | "GPM"
  | "CFS"
  | "LPM"
  | "MGD"
  | "MLD"
  | "IMGD"
  | "CMH"
  | "AFD"
  | "CMD";

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

const buildReactionsSection = (settings: SimulationSettings): string[] => {
  const dq = defaultWaterQualityValues;
  const lines: string[] = ["[REACTIONS]"];
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

const buildEnergySection = (
  settings: SimulationSettings,
  idMap: EpanetIds,
): string[] => {
  const de = defaultEnergyValues;
  const lines: string[] = ["[ENERGY]"];
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

const isDefaultPressureForSystem = (
  unitSystem: EpanetUnitSystem,
  pressureUnit: string,
): boolean => {
  if (US_UNIT_SYSTEMS.includes(unitSystem)) return pressureUnit === "psi";
  return pressureUnit === "mwc";
};

class EpanetIds {
  private strategy: "id" | "label";
  private assetIds: Map<AssetId, string>;
  private linkIds: Set<string>;
  private nodeIds: Set<string>;
  private patternIds: Map<PatternId, string>;
  private patternLabels: Set<string>;
  private curveIds: Map<CurveId, string>;
  private curveLabels: Set<string>;

  constructor({ strategy }: { strategy: "id" | "label" }) {
    this.strategy = strategy;
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
        const id = this.ensureUnique(this.linkIds, link.label);
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
        const id = this.ensureUnique(this.nodeIds, node.label);
        this.nodeIds.add(id);
        this.assetIds.set(node.id, id);
        return id;
    }
  }

  registerCurveId(curve: Pick<ICurve, "id" | "label">) {
    if (this.curveIds.has(curve.id)) return this.curveIds.get(curve.id);
    const label = this.ensureUnique(this.curveLabels, curve.label);
    this.curveLabels.add(label);
    this.curveIds.set(curve.id, label);
    return label;
  }

  curveId(curveId: CurveId): string {
    return this.curveIds.get(curveId) ?? "*";
  }

  localCurveId(candidate: string) {
    const label = this.ensureUnique(this.curveLabels, candidate);
    this.curveLabels.add(label);
    return label;
  }

  registerPatternId(pattern: Pick<Pattern, "id" | "label">) {
    if (this.patternIds.has(pattern.id))
      return this.patternIds.get(pattern.id)!;
    const label = this.ensureUnique(this.patternLabels, pattern.label);
    this.patternLabels.add(label);
    this.patternIds.set(pattern.id, label);
    return label;
  }

  patternId(patternId: PatternId): string {
    return this.patternIds.get(patternId) ?? "*";
  }

  private ensureUnique(
    takenIds: Set<string>,
    candidate: string,
    count = 0,
  ): string {
    const newCandidate = count > 0 ? `${candidate}.${count}` : candidate;
    if (!takenIds.has(newCandidate)) {
      return newCandidate;
    } else {
      return this.ensureUnique(takenIds, candidate, count + 1);
    }
  }
}

type InpSections = {
  junctions: string[];
  reservoirs: string[];
  tanks: string[];
  pipes: string[];
  pumps: string[];
  valves: string[];
  demands: string[];
  emitters: string[];
  times: string[];
  report: string[];
  status: string[];
  curves: string[];
  patterns: string[];
  options: string[];
  backdrop: string[];
  coordinates: string[];
  vertices: string[];
  customers: string[];
  customersDemands: string[];
  quality: string[];
  mixing: string[];
  sources: string[];
  reactions: string[];
  energy: string[];
  controls: string[];
  rules: string[];
};

type BuildOptions = {
  simulationSettings: SimulationSettings;
  units: UnitsSpec;
  headlossFormula?: HeadlossFormula;
  geolocation?: boolean;
  madeBy?: boolean;
  labelIds?: boolean;
  customerDemands?: boolean;
  customerPoints?: boolean;
  inactiveAssets?: boolean;
  usedPatterns?: boolean;
  usedCurves?: boolean;
  reservoirElevations?: boolean;
  includeQuality?: boolean;
  projection?: Projection;
};

export const buildInp = withDebugInstrumentation(
  (hydraulicModel: HydraulicModel, options: BuildOptions): string => {
    const opts = {
      headlossFormula: "H-W" as HeadlossFormula,
      geolocation: false,
      madeBy: false,
      labelIds: false,
      customerDemands: false,
      customerPoints: false,
      inactiveAssets: false,
      usedPatterns: false,
      usedCurves: false,
      reservoirElevations: false,
      includeQuality: false,
      ...options,
    };
    const idMap = new EpanetIds({ strategy: opts.labelIds ? "label" : "id" });
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

    const sections: InpSections = {
      junctions: ["[JUNCTIONS]", ";Id\tElevation"],
      reservoirs: ["[RESERVOIRS]", ";Id\tHead\tPattern"],
      tanks: [
        "[TANKS]",
        ";Id\tElevation\tInitLevel\tMinLevel\tMaxLevel\tDiameter\tMinVol",
      ],
      pipes: [
        "[PIPES]",
        ";Id\tStart\tEnd\tLength\tDiameter\tRoughness\tMinorLoss\tStatus",
      ],
      pumps: ["[PUMPS]", ";Id\tStart\tEnd\tProperties"],
      valves: ["[VALVES]", ";Id\tStart\tEnd\tDiameter\tSetting\tMinorLoss"],
      demands: ["[DEMANDS]", ";Id\tDemand\tPattern\tCategory"],
      emitters: ["[EMITTERS]", ";Junction\tCoefficient"],
      times: buildTimesSection(opts.simulationSettings.timing),
      report: [
        "[REPORT]",
        `Status\t${opts.simulationSettings.statusReport}`,
        "Summary\tNo",
        "Page\t0",
        ...(opts.simulationSettings.reportEnergy ? ["Energy\tYES"] : []),
      ],
      status: ["[STATUS]", ";Id\tStatus"],
      curves: ["[CURVES]", ";Id\tX\tY"],
      patterns: ["[PATTERNS]", ";Id\tMultiplier"],
      options: [
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
        opts.simulationSettings.flowChange !==
          defaultHydraulicsValues.flowChange
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
      backdrop: [
        "[BACKDROP]",
        `Units\t${opts.projection ? getBackdropUnits(opts.projection) : "DEGREES"}`,
      ],
      coordinates: ["[COORDINATES]", ";Node\tX-coord\tY-coord"],
      vertices: ["[VERTICES]", ";link\tX-coord\tY-coord"],
      customers: [
        ";[CUSTOMERS]",
        ";Id\tX-coord\tY-coord\tBaseDemand\tPipeId\tJunctionId\tSnapX\tSnapY",
      ],
      customersDemands: [";[CUSTOMERS_DEMANDS]", ";Id\tBaseDemand\tPatternId"],
      quality: ["[QUALITY]", ";Node\tInitialQuality"],
      mixing: ["[MIXING]", ";Tank\tModel\tFraction"],
      sources: ["[SOURCES]", ";Node\tType\tStrength\tPattern"],
      reactions: buildReactionsSection(opts.simulationSettings),
      energy: buildEnergySection(opts.simulationSettings, idMap),
      controls: ["[CONTROLS]"],
      rules: ["[RULES]"],
    };

    const usedCurveIds = new Set<number>();
    const usedPatternIds = new Set<number>();

    if (opts.simulationSettings.energyGlobalPatternId !== null) {
      usedPatternIds.add(opts.simulationSettings.energyGlobalPatternId);
    }

    for (const asset of hydraulicModel.assets.values()) {
      if (asset.type === "reservoir") {
        appendReservoir(
          sections,
          idMap,
          opts.geolocation,
          opts.inactiveAssets,
          opts.reservoirElevations,
          asset as Reservoir,
          usedPatternIds,
          transformCoord,
        );
        if (opts.includeQuality) {
          appendInitialQuality(
            sections,
            idMap,
            asset as Reservoir,
            opts.simulationSettings,
          );
          appendSource(sections, idMap, asset as Reservoir);
        }
      }

      if (asset.type === "tank") {
        appendTank(
          sections,
          idMap,
          opts.geolocation,
          opts.inactiveAssets,
          usedCurveIds,
          asset as Tank,
          transformCoord,
        );
        if (opts.includeQuality) {
          appendInitialQuality(
            sections,
            idMap,
            asset as Tank,
            opts.simulationSettings,
          );
          appendMixing(sections, idMap, asset as Tank);
          appendSource(sections, idMap, asset as Tank);
          appendTankReaction(sections, idMap, asset as Tank);
        }
      }

      if (asset.type === "junction") {
        appendJunction(
          sections,
          idMap,
          opts.geolocation,
          opts.customerDemands,
          opts.inactiveAssets,
          asset as Junction,
          hydraulicModel.customerPointsLookup,
          hydraulicModel.assets,
          hydraulicModel.demands,
          usedPatternIds,
          transformCoord,
        );
        if (opts.includeQuality) {
          appendInitialQuality(
            sections,
            idMap,
            asset as Junction,
            opts.simulationSettings,
          );
          appendSource(sections, idMap, asset as Junction);
        }
      }

      if (asset.type === "pipe") {
        appendPipe(
          sections,
          idMap,
          hydraulicModel,
          opts.geolocation,
          opts.inactiveAssets,
          asset as Pipe,
          transformCoord,
        );
        if (opts.includeQuality) {
          appendPipeReaction(sections, idMap, asset as Pipe);
        }
      }

      if (asset.type === "pump") {
        appendPump(
          sections,
          idMap,
          hydraulicModel,
          opts.geolocation,
          opts.inactiveAssets,
          usedCurveIds,
          usedPatternIds,
          asset as Pump,
          transformCoord,
        );
      }

      if (asset.type === "valve") {
        appendValve(
          sections,
          idMap,
          hydraulicModel,
          opts.geolocation,
          opts.inactiveAssets,
          usedCurveIds,
          asset as Valve,
          transformCoord,
        );
      }
    }

    if (opts.customerPoints) {
      for (const customerPoint of hydraulicModel.customerPoints.values()) {
        appendCustomerPoint(
          sections,
          idMap,
          hydraulicModel,
          customerPoint,
          usedPatternIds,
          transformCoord,
        );
      }
    }

    const includeCustomerPoints =
      opts.customerPoints && hydraulicModel.customerPoints.size > 0;

    appendPatterns(
      sections,
      hydraulicModel.patterns,
      usedPatternIds,
      idMap,
      opts.usedPatterns,
    );

    appendCurves(
      sections,
      hydraulicModel.curves,
      usedCurveIds,
      idMap,
      opts.usedCurves,
    );

    appendControls(sections, hydraulicModel.controls, idMap, hydraulicModel);

    const hasControls = sections.controls.length > 1;
    const hasRules = sections.rules.length > 1;
    const hasEmitters = sections.emitters.length > 2;
    const hasQuality = sections.quality.length > 2;
    const hasMixing = sections.mixing.length > 2;
    const hasSources = sections.sources.length > 2;
    const hasReactions = sections.reactions.length > 1;
    const hasEnergy = sections.energy.length > 1;

    let content = [
      sections.junctions.join("\n"),
      sections.reservoirs.join("\n"),
      sections.tanks.join("\n"),
      sections.pipes.join("\n"),
      sections.pumps.join("\n"),
      sections.valves.join("\n"),
      sections.demands.join("\n"),
      hasEmitters && sections.emitters.join("\n"),
      sections.status.join("\n"),
      sections.curves.join("\n"),
      sections.patterns.join("\n"),
      sections.times.join("\n"),
      sections.report.join("\n"),
      sections.options.join("\n"),
      hasQuality && sections.quality.join("\n"),
      hasMixing && sections.mixing.join("\n"),
      hasSources && sections.sources.join("\n"),
      hasReactions && sections.reactions.join("\n"),
      hasEnergy && sections.energy.join("\n"),
      opts.geolocation && sections.backdrop.join("\n"),
      opts.geolocation && sections.coordinates.join("\n"),
      opts.geolocation && sections.vertices.join("\n"),
      includeCustomerPoints && sections.customers.join("\n"),
      includeCustomerPoints && sections.customersDemands.join("\n"),
      hasControls && sections.controls.join("\n"),
      hasRules && sections.rules.join("\n"),
      "[END]",
    ]
      .filter((f) => !!f)
      .join("\n\n");

    if (opts.madeBy) {
      const projection = opts.projection;
      if (projection && projection.type !== "wgs84") {
        if (projection.type === "proj4") {
          content = `;PROJECTION_NAME ${projection.name}\n` + content;
          content = `;PROJECTION_PROJ4 ${projection.code}\n` + content;
          content = `;PROJECTION_TYPE ${projection.type}\n` + content;
        }
        content = `;PROJECTION ${projection.id}\n` + content;
      }
      content = `;MADE BY EPANET-JS [${checksum(content)}]\n` + content;
    }
    return content;
  },
  { name: "BUILD_INP", maxDurationMs: 1000 },
);

const appendInitialQuality = (
  sections: InpSections,
  idMap: EpanetIds,
  node: NodeAsset,
  simulationSettings: SimulationSettings,
) => {
  const typedNode = node as Junction | Tank | Reservoir;
  const value =
    simulationSettings.qualitySimulationType === "chemical"
      ? typedNode.initialChemicalConcentration
      : typedNode.initialWaterAge;
  if (value !== undefined && value !== 0) {
    sections.quality.push(`${idMap.nodeId(node)}\t${value}`);
  }
};

const MIXING_MODEL_TO_INP: Record<string, string> = {
  mixed: "MIXED",
  "2comp": "2COMP",
  fifo: "FIFO",
  lifo: "LIFO",
};

const appendMixing = (sections: InpSections, idMap: EpanetIds, tank: Tank) => {
  if (tank.mixingModel === "mixed") return;
  const model = MIXING_MODEL_TO_INP[tank.mixingModel] ?? "MIXED";
  const row =
    tank.mixingModel === "2comp"
      ? `${idMap.nodeId(tank)}\t${model}\t${tank.mixingFraction}`
      : `${idMap.nodeId(tank)}\t${model}`;
  sections.mixing.push(row);
};

const appendSource = (
  sections: InpSections,
  idMap: EpanetIds,
  node: NodeAsset,
) => {
  const typedNode = node as Junction | Tank | Reservoir;
  const sourceType = typedNode.chemicalSourceType;
  if (!sourceType) return;
  const strength = typedNode.chemicalSourceStrength ?? 0;
  const patternId = typedNode.chemicalSourcePatternId;
  const row = patternId
    ? `${idMap.nodeId(node)}\t${sourceType}\t${strength}\t${idMap.patternId(patternId)}`
    : `${idMap.nodeId(node)}\t${sourceType}\t${strength}`;
  sections.sources.push(row);
};

const appendPipeReaction = (
  sections: InpSections,
  idMap: EpanetIds,
  pipe: Pipe,
) => {
  if (pipe.bulkReactionCoeff !== undefined) {
    sections.reactions.push(
      `Bulk\t${idMap.linkId(pipe)}\t${pipe.bulkReactionCoeff}`,
    );
  }
  if (pipe.wallReactionCoeff !== undefined) {
    sections.reactions.push(
      `Wall\t${idMap.linkId(pipe)}\t${pipe.wallReactionCoeff}`,
    );
  }
};

const appendTankReaction = (
  sections: InpSections,
  idMap: EpanetIds,
  tank: Tank,
) => {
  if (tank.bulkReactionCoeff !== undefined) {
    sections.reactions.push(
      `Tank\t${idMap.nodeId(tank)}\t${tank.bulkReactionCoeff}`,
    );
  }
};

const appendReservoir = (
  sections: InpSections,
  idMap: EpanetIds,
  geolocation: boolean,
  inactiveAssets: boolean,
  elevations: boolean,
  reservoir: Reservoir,
  usedPatternIds: Set<number>,
  transformCoord: (p: Position) => Position,
) => {
  if (!reservoir.isActive && !inactiveAssets) {
    return;
  }

  const reservoirId = idMap.nodeId(reservoir);
  const commentPrefix = !reservoir.isActive ? ";" : "";

  const columns: (string | number)[] = [reservoirId, reservoir.head];
  if (reservoir.headPatternId) {
    columns.push(idMap.patternId(reservoir.headPatternId));
    usedPatternIds.add(reservoir.headPatternId);
  }
  let reservoirLine = commentPrefix + columns.join("\t");
  if (elevations && reservoir.elevation) {
    reservoirLine += `\t;Elevation:${reservoir.elevation}`;
  }

  sections.reservoirs.push(reservoirLine);

  if (geolocation) {
    appendNodeCoordinates(
      sections,
      idMap,
      reservoir,
      transformCoord,
      commentPrefix,
    );
  }
};

const appendTank = (
  sections: InpSections,
  idMap: EpanetIds,
  geolocation: boolean,
  inactiveAssets: boolean,
  usedCurveIds: Set<number>,
  tank: Tank,
  transformCoord: (p: Position) => Position,
) => {
  if (!tank.isActive && !inactiveAssets) {
    return;
  }

  const tankId = idMap.nodeId(tank);
  const commentPrefix = !tank.isActive ? ";" : "";

  sections.tanks.push(
    commentPrefix +
      [
        tankId,
        tank.elevation,
        tank.initialLevel,
        tank.minLevel,
        tank.maxLevel,
        tank.diameter,
        tank.minVolume,
        tank.volumeCurveId ? idMap.curveId(tank.volumeCurveId) : "*",
        tank.overflow ? "YES" : "NO",
      ].join("\t"),
  );
  if (geolocation) {
    appendNodeCoordinates(sections, idMap, tank, transformCoord, commentPrefix);
  }
  if (tank.volumeCurveId) usedCurveIds.add(tank.volumeCurveId);
};

const appendJunction = (
  sections: InpSections,
  idMap: EpanetIds,
  geolocation: boolean,
  customerDemands: boolean,
  inactiveAssets: boolean,
  junction: Junction,
  customerPointsLookup: CustomerPointsLookup,
  assets: HydraulicModel["assets"],
  demands: Demands,
  usedPatternIds: Set<number>,
  transformCoord: (p: Position) => Position,
) => {
  if (!junction.isActive && !inactiveAssets) {
    return;
  }

  const junctionId = idMap.nodeId(junction);
  const commentPrefix = !junction.isActive ? ";" : "";

  sections.junctions.push(
    commentPrefix + [junctionId, junction.elevation].join("\t"),
  );

  const junctionDemands = getJunctionDemands(demands, junction.id);
  for (const demand of junctionDemands) {
    if (demand.baseDemand === 0) continue;

    const demandLine = demand.patternId
      ? [junctionId, demand.baseDemand, idMap.patternId(demand.patternId)]
      : [junctionId, demand.baseDemand];

    sections.demands.push(commentPrefix + demandLine.join("\t"));

    if (demand.patternId) {
      usedPatternIds.add(demand.patternId);
    }
  }

  if (customerDemands) {
    const customerPoints = getActiveCustomerPoints(
      customerPointsLookup,
      assets,
      junction.id,
    );

    const demandsByPattern = new Map<number | undefined, number>();
    for (const cp of customerPoints) {
      for (const demand of getCustomerPointDemands(demands, cp.id)) {
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

      demandLine.push(";" + defaultCustomersPatternId);
      sections.demands.push(commentPrefix + demandLine.join("\t"));

      if (patternId) {
        usedPatternIds.add(patternId);
      }
    }
  }

  if (junction.emitterCoefficient > 0) {
    sections.emitters.push(
      commentPrefix + [junctionId, junction.emitterCoefficient].join("\t"),
    );
  }

  if (geolocation) {
    appendNodeCoordinates(
      sections,
      idMap,
      junction,
      transformCoord,
      commentPrefix,
    );
  }
};

const appendPipe = (
  sections: InpSections,
  idMap: EpanetIds,
  hydraulicModel: HydraulicModel,
  geolocation: boolean,
  inactiveAssets: boolean,
  pipe: Pipe,
  transformCoord: (p: Position) => Position,
) => {
  if (!pipe.isActive && !inactiveAssets) {
    return;
  }

  const linkId = idMap.linkId(pipe);
  const [startId, endId] = getLinkConnectionIds(hydraulicModel, idMap, pipe);
  const commentPrefix = !pipe.isActive ? ";" : "";

  sections.pipes.push(
    commentPrefix +
      [
        linkId,
        startId,
        endId,
        pipe.length,
        pipe.diameter,
        pipe.roughness,
        pipe.minorLoss,
        pipeStatusFor(pipe),
      ].join("\t"),
  );
  if (geolocation) {
    appendLinkVertices(sections, idMap, pipe, transformCoord, commentPrefix);
  }
};

const appendPump = (
  sections: InpSections,
  idMap: EpanetIds,
  hydraulicModel: HydraulicModel,
  geolocation: boolean,
  inactiveAssets: boolean,
  usedCurveIds: Set<number>,
  usedPatternIds: Set<number>,
  pump: Pump,
  transformCoord: (p: Position) => Position,
) => {
  if (!pump.isActive && !inactiveAssets) {
    return;
  }

  const linkId = idMap.linkId(pump);
  const [startId, endId] = getLinkConnectionIds(hydraulicModel, idMap, pump);
  const commentPrefix = !pump.isActive ? ";" : "";

  const speedPatternParts: string[] = [];
  if (pump.speedPatternId) {
    speedPatternParts.push(`PATTERN ${idMap.patternId(pump.speedPatternId)}`);
    usedPatternIds.add(pump.speedPatternId);
  }

  switch (pump.definitionType) {
    case "power":
      sections.pumps.push(
        commentPrefix +
          [
            linkId,
            startId,
            endId,
            `POWER ${pump.power}`,
            `SPEED ${pump.speed}`,
            ...speedPatternParts,
          ].join("\t"),
      );
      break;
    case "curve":
      const localCurveId = idMap.localCurveId(pump.label);
      sections.pumps.push(
        commentPrefix +
          [
            linkId,
            startId,
            endId,
            `HEAD ${localCurveId}`,
            `SPEED ${pump.speed}`,
            ...speedPatternParts,
          ].join("\t"),
      );
      sections.curves.push(";PUMP:");
      pump.curve!.forEach((point) =>
        sections.curves.push(
          [localCurveId, String(point.x), String(point.y)].join("\t"),
        ),
      );
      break;
    case "curveId":
      const curveId = pump.curveId ? idMap.curveId(pump.curveId) : "";

      sections.pumps.push(
        [
          linkId,
          startId,
          endId,
          `HEAD ${curveId}`,
          `SPEED ${pump.speed}`,
          ...speedPatternParts,
        ].join("\t"),
      );
      if (pump.curveId) usedCurveIds.add(pump.curveId);
  }

  sections.status.push(
    commentPrefix + [linkId, pumpStatusFor(pump)].join("\t"),
  );

  if (pump.efficiencyCurveId) {
    sections.energy.push(
      `Pump ${linkId} Efficiency\t${idMap.curveId(pump.efficiencyCurveId)}`,
    );
    usedCurveIds.add(pump.efficiencyCurveId);
  }
  if (pump.energyPrice !== undefined) {
    sections.energy.push(`Pump ${linkId} Price\t${pump.energyPrice}`);
  }
  if (pump.energyPricePatternId) {
    sections.energy.push(
      `Pump ${linkId} Pattern\t${idMap.patternId(pump.energyPricePatternId)}`,
    );
    usedPatternIds.add(pump.energyPricePatternId);
  }

  if (geolocation) {
    appendLinkVertices(sections, idMap, pump, transformCoord, commentPrefix);
  }
};

const appendValve = (
  sections: InpSections,
  idMap: EpanetIds,
  hydraulicModel: HydraulicModel,
  geolocation: boolean,
  inactiveAssets: boolean,
  usedCurveIds: Set<number>,
  valve: Valve,
  transformCoord: (p: Position) => Position,
) => {
  if (!valve.isActive && !inactiveAssets) {
    return;
  }

  const linkId = idMap.linkId(valve);
  const commentPrefix = !valve.isActive ? ";" : "";
  const valveCurveId = valve.curveId ? idMap.curveId(valve.curveId) : "";

  const valveData = [
    linkId,
    ...getLinkConnectionIds(hydraulicModel, idMap, valve),
    String(valve.diameter),
    kindFor(valve),
    valve.kind === "gpv" ? valveCurveId : String(valve.setting),
    String(valve.minorLoss),
  ];
  if (valve.kind === "pcv") {
    valveData.push(valveCurveId);
  }
  if (valve.curveId) usedCurveIds.add(valve.curveId);

  sections.valves.push(commentPrefix + valveData.join("\t"));

  if (valve.initialStatus !== "active") {
    const fixedStatus = valveFixedStatusFor(valve);
    sections.status.push(commentPrefix + [linkId, fixedStatus].join("\t"));
  }

  if (geolocation) {
    appendLinkVertices(sections, idMap, valve, transformCoord, commentPrefix);
  }
};

const getLinkConnectionIds = (
  hydraulicModel: HydraulicModel,
  idMap: EpanetIds,
  link: LinkAsset,
) => {
  const [nodeStart, nodeEnd] = link.connections;

  const startNodeId = idMap.nodeId(
    hydraulicModel.assets.get(nodeStart) as NodeAsset,
  );
  const endNodeId = idMap.nodeId(
    hydraulicModel.assets.get(nodeEnd) as NodeAsset,
  );

  return [startNodeId, endNodeId];
};

const appendNodeCoordinates = (
  sections: InpSections,
  idMap: EpanetIds,
  node: NodeAsset,
  transformCoord: (p: Position) => Position,
  commentPrefix = "",
) => {
  const coords = transformCoord(node.coordinates);
  sections.coordinates.push(
    commentPrefix + [idMap.nodeId(node), ...coords].join("\t"),
  );
};

const appendLinkVertices = (
  sections: InpSections,
  idMap: EpanetIds,
  link: LinkAsset,
  transformCoord: (p: Position) => Position,
  commentPrefix = "",
) => {
  for (const vertex of link.intermediateVertices) {
    const coords = transformCoord(vertex);
    sections.vertices.push(
      commentPrefix + [idMap.linkId(link), ...coords].join("\t"),
    );
  }
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

const pumpStatusFor = (pump: Pump): SimulationPumpStatus | number => {
  if (pump.initialStatus === "off" || pump.speed === 0) return "Closed";

  if (pump.speed !== 1) return pump.speed;

  return "Open";
};

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

const appendControls = (
  sections: InpSections,
  controls: HydraulicModel["controls"],
  idMap: EpanetIds,
  hydraulicModel: HydraulicModel,
) => {
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

  for (const control of controls.simple) {
    sections.controls.push(formatSimpleControl(control, idResolver));
  }

  for (const rule of controls.rules) {
    sections.rules.push(formatRuleBasedControl(rule, idResolver));
  }
};

const CURVE_TYPE_TO_KEYWORD: Record<string, string> = {
  pump: "PUMP",
  efficiency: "EFFICIENCY",
  volume: "VOLUME",
  headloss: "HEADLOSS",
  valve: "VALVE",
};

const appendCurves = (
  sections: InpSections,
  curves: HydraulicModel["curves"],
  usedCurveIds: Set<number>,
  idMap: EpanetIds,
  usedCurvesOnly: boolean,
) => {
  for (const curve of curves.values()) {
    if (usedCurvesOnly && !usedCurveIds.has(curve.id)) continue;
    const curveId = idMap.registerCurveId(curve);
    const keyword = curve.type ? CURVE_TYPE_TO_KEYWORD[curve.type] : undefined;
    if (keyword) sections.curves.push(`;${keyword}:`);
    for (const point of curve.points) {
      sections.curves.push(
        [curveId, String(point.x), String(point.y)].join("\t"),
      );
    }
  }
};

const PATTERN_TYPE_TO_KEYWORD: Record<string, string> = {
  demand: "DEMAND",
  reservoirHead: "RESERVOIR",
  pumpSpeed: "SPEED",
  energyPrice: "ENERGY_PRICE",
};

const appendPatterns = (
  sections: InpSections,
  patterns: Patterns,
  usedPatternIds: Set<number>,
  idMap: EpanetIds,
  usedPatternsOnly: boolean,
) => {
  const constantPatternId = idMap.patternId(defaultConstantPatternId);
  sections.patterns.push([constantPatternId, "1"].join("\t"));

  for (const pattern of patterns.values()) {
    const mappedId = idMap.patternId(pattern.id);
    if (usedPatternsOnly && !usedPatternIds.has(pattern.id)) continue;

    const keyword = pattern.type
      ? PATTERN_TYPE_TO_KEYWORD[pattern.type]
      : undefined;
    if (keyword) sections.patterns.push(`;${keyword}:`);

    const FACTORS_PER_LINE = 8;
    for (let i = 0; i < pattern.multipliers.length; i += FACTORS_PER_LINE) {
      const chunk = pattern.multipliers.slice(i, i + FACTORS_PER_LINE);
      sections.patterns.push([mappedId, ...chunk.map(String)].join("\t"));
    }
  }
};

const appendCustomerPoint = (
  sections: InpSections,
  idMap: EpanetIds,
  hydraulicModel: HydraulicModel,
  customerPoint: CustomerPoint,
  usedPatternIds: Set<number>,
  transformCoord: (p: Position) => Position,
) => {
  const connection = customerPoint.connection;
  const [x, y] = transformCoord(customerPoint.coordinates);

  if (connection) {
    const [snapX, snapY] = transformCoord(connection.snapPoint);

    const junction = hydraulicModel.assets.get(
      connection.junctionId,
    ) as Junction;
    const pipe = hydraulicModel.assets.get(connection.pipeId) as LinkAsset;
    sections.customers.push(
      ";" +
        [
          customerPoint.label,
          x,
          y,
          "",
          idMap.linkId(pipe),
          idMap.nodeId(junction),
          snapX,
          snapY,
        ].join("\t"),
    );
  } else {
    sections.customers.push(
      ";" + [customerPoint.label, x, y, "", "", "", "", ""].join("\t"),
    );
  }

  const demands = getCustomerPointDemands(
    hydraulicModel.demands,
    customerPoint.id,
  );
  for (const demand of demands) {
    const mappedPatternId = demand.patternId
      ? idMap.patternId(demand.patternId)
      : undefined;
    sections.customersDemands.push(
      ";" +
        [customerPoint.label, demand.baseDemand, mappedPatternId ?? ""].join(
          "\t",
        ),
    );
    if (demand.patternId) {
      usedPatternIds.add(demand.patternId);
    }
  }
};
