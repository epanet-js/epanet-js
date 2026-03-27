import { ProjectSettings } from "src/lib/project-settings";
import { IssuesAccumulator, ParserIssues } from "./issues";
import { readInpData } from "./read-inp-data";
import { buildModel, isWgs84 } from "./build-model";
import {
  HydraulicModel,
  AssetsMap,
  type NodeAsset,
  type LinkAsset,
} from "src/hydraulic-model";
import { ModelFactories } from "src/hydraulic-model/factories";
import { nanoid } from "nanoid";
import {
  defaultTiming,
  defaultSimulationSettings,
  defaultWaterQualityValues,
  defaultEnergyValues,
  defaultReportValues,
} from "src/simulation/simulation-settings";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import { checksum } from "src/infra/checksum";
import { InpData, InpStats } from "./inp-data";
import { Position } from "geojson";
import {
  type Projection,
  WGS84,
  createProjectionMapper,
} from "src/lib/projections";
import { createProjectionTransformer } from "src/lib/geojson-utils/coordinate-transform";
import { computeCentroid } from "src/lib/projections/xy-grid-transform";

type SourceProjection = { id: string; name: string; code?: string };

export const XY_GRID: SourceProjection = { id: "xy-grid", name: "XY Grid" };

export type ParseInpOptions = {
  customerPoints?: boolean;
  inactiveAssets?: boolean;
  sourceProjection?: SourceProjection;
  projectLater?: boolean;
};

export type ParseInpResult = {
  isMadeByApp: boolean;
  hydraulicModel: HydraulicModel;
  factories: ModelFactories;
  projectSettings: ProjectSettings;
  simulationSettings: SimulationSettings;
  issues: ParserIssues | null;
  stats: InpStats;
  projectionStatus?: "wgs84" | "unknown";
};

export const parseInp = (
  inp: string,
  options?: ParseInpOptions,
): ParseInpResult => {
  const issues = new IssuesAccumulator();
  const header = parseHeader(inp);

  const safeOptions: ParseInpOptions = {
    ...options,
    customerPoints: header.isMadeByApp ? options?.customerPoints : false,
    inactiveAssets: header.isMadeByApp ? options?.inactiveAssets : false,
  };

  const { inpData, stats } = readInpData(inp, issues, safeOptions);

  const projectLater = options?.projectLater ?? false;
  const headerProjection = header.sourceProjection;
  const sourceProjection: SourceProjection =
    headerProjection ?? options?.sourceProjection ?? WGS84;

  const skipProjection = projectLater && !headerProjection;

  let projection: Projection;
  let projectionStatus: "wgs84" | "unknown" | undefined;

  if (skipProjection) {
    projection = WGS84;

    const { hydraulicModel, factories, projectSettings } = buildModel(
      inpData,
      issues,
      { ...safeOptions, skipWgs84Validation: true },
    );

    projectionStatus = detectProjectionStatus(hydraulicModel);

    return {
      isMadeByApp: header.isMadeByApp,
      hydraulicModel,
      factories,
      projectSettings: {
        ...projectSettings,
        projection,
      },
      simulationSettings: buildSimulationSettings(inpData, hydraulicModel),
      issues: issues.buildResult(),
      stats,
      projectionStatus,
    };
  }

  projection = projectCoordinates(inpData, sourceProjection);

  const { hydraulicModel, factories, projectSettings } = buildModel(
    inpData,
    issues,
    safeOptions,
  );
  return {
    isMadeByApp: header.isMadeByApp,
    hydraulicModel,
    factories,
    projectSettings: {
      ...projectSettings,
      projection,
    },
    simulationSettings: buildSimulationSettings(inpData, hydraulicModel),
    issues: issues.buildResult(),
    stats,
  };
};

const projectCoordinates = (
  inpData: InpData,
  source: SourceProjection,
): Projection => {
  if (source.id === "wgs84") {
    return WGS84;
  }

  if (source.id === "xy-grid") {
    return projectXYGrid(inpData);
  }

  return projectWithCode(inpData, source);
};

const projectXYGrid = (inpData: InpData): Projection => {
  const allPoints: Position[] = [];
  for (const [, p] of inpData.coordinates.entries()) allPoints.push(p);
  for (const [, verts] of inpData.vertices.entries()) allPoints.push(...verts);
  for (const cp of inpData.customerPoints) allPoints.push(cp.coordinates);

  const centroid = computeCentroid(allPoints);
  const projection: Projection = {
    type: "xy-grid",
    id: "xy-grid",
    name: "XY Grid",
    centroid,
  };
  const mapper = createProjectionMapper(projection);

  transformInpData(inpData, mapper.toWgs84);

  return projection;
};

const projectWithCode = (
  inpData: InpData,
  source: SourceProjection,
): Projection => {
  const transform = createProjectionTransformer(source.code!);

  transformInpData(inpData, (p) => transform(p as [number, number]));

  return {
    type: "proj4",
    id: source.id,
    name: source.name,
    code: source.code!,
  };
};

const transformInpData = (
  inpData: InpData,
  transform: (p: Position) => Position,
) => {
  for (const [id, p] of inpData.coordinates.entries()) {
    inpData.coordinates.set(id, transform(p));
  }
  for (const [id, verts] of inpData.vertices.entries()) {
    inpData.vertices.set(id, verts.map(transform));
  }
  for (const cp of inpData.customerPoints) {
    cp.coordinates = transform(cp.coordinates) as [number, number];
    if ("snapPoint" in cp && cp.snapPoint) {
      cp.snapPoint = transform(cp.snapPoint) as [number, number];
    }
  }
};

type Header = { isMadeByApp: boolean; sourceProjection?: SourceProjection };

const checksumRegexp = /\[([0-9A-Fa-f]{8})\]/;

const parseHeader = (inp: string): Header => {
  const newLineIndex = inp.indexOf("\n");
  if (newLineIndex === -1) return { isMadeByApp: false };

  const checksumRow = inp.substring(0, newLineIndex);
  if (!checksumRow.includes(";MADE BY EPANET-JS"))
    return { isMadeByApp: false };

  const match = checksumRow.match(checksumRegexp);
  if (!match) return { isMadeByApp: false };

  const inputChecksum = match[1];
  const rest = inp.substring(newLineIndex + 1);
  const computedChecksum = checksum(rest);
  if (inputChecksum !== computedChecksum) return { isMadeByApp: false };

  const sourceProjection = parseProjectionMetadata(rest);

  return { isMadeByApp: true, sourceProjection };
};

const parseProjectionMetadata = (
  content: string,
): SourceProjection | undefined => {
  let id: string | undefined;
  let name: string | undefined;
  let code: string | undefined;

  const lines = content.split("\n");
  for (const line of lines) {
    if (!line.startsWith(";")) break;

    if (line.startsWith(";PROJECTION_TYPE ")) continue;
    if (line.startsWith(";PROJECTION_PROJ4 ")) {
      code = line.substring(";PROJECTION_PROJ4 ".length).trim();
    } else if (line.startsWith(";PROJECTION_NAME ")) {
      name = line.substring(";PROJECTION_NAME ".length).trim();
    } else if (line.startsWith(";PROJECTION ")) {
      id = line.substring(";PROJECTION ".length).trim();
    }
  }

  if (id === "wgs84") return WGS84;
  if (id === "xy-grid") return XY_GRID;

  if (id && code) {
    return { id, name: name ?? id, code };
  }

  return undefined;
};

const resolveTraceNodeId = (
  label: string | undefined,
  assets: AssetsMap,
): number | null => {
  if (!label) return null;
  for (const asset of assets.values()) {
    if (asset.isNode && asset.label === label) return asset.id;
  }
  return null;
};

const resolveEnergyPatternId = (
  label: string | undefined,
  hydraulicModel: HydraulicModel,
): number | null => {
  if (!label) return null;
  return hydraulicModel.labelManager.getIdByLabel(label, "pattern") ?? null;
};

const detectProjectionStatus = (
  hydraulicModel: HydraulicModel,
): "wgs84" | "unknown" => {
  for (const asset of hydraulicModel.assets.values()) {
    if (asset.isNode) {
      const node = asset as NodeAsset;
      if (!isWgs84(node.coordinates)) return "unknown";
    } else {
      const link = asset as LinkAsset;
      for (const coord of link.coordinates) {
        if (!isWgs84(coord)) return "unknown";
      }
    }
  }
  return "wgs84";
};

const buildSimulationSettings = (
  inpData: InpData,
  hydraulicModel: HydraulicModel,
): SimulationSettings => ({
  version: nanoid(),
  timing: { ...defaultTiming, ...inpData.times },
  globalDemandMultiplier: inpData.options.demandMultiplier,
  demandModel:
    inpData.options.demandModel ?? defaultSimulationSettings.demandModel,
  minimumPressure:
    inpData.options.minimumPressure ??
    defaultSimulationSettings.minimumPressure,
  requiredPressure:
    inpData.options.requiredPressure ??
    defaultSimulationSettings.requiredPressure,
  pressureExponent:
    inpData.options.pressureExponent ??
    defaultSimulationSettings.pressureExponent,
  emitterExponent:
    inpData.options.emitterExponent ??
    defaultSimulationSettings.emitterExponent,
  backflowAllowed:
    inpData.options.backflowAllowed ??
    defaultSimulationSettings.backflowAllowed,
  ...(inpData.options.trials !== undefined && {
    trials: inpData.options.trials,
  }),
  ...(inpData.options.accuracy !== undefined && {
    accuracy: inpData.options.accuracy,
  }),
  ...(inpData.options.unbalancedMode !== undefined && {
    unbalancedMode: inpData.options.unbalancedMode,
  }),
  ...(inpData.options.unbalancedExtraTrials !== undefined && {
    unbalancedExtraTrials: inpData.options.unbalancedExtraTrials,
  }),
  ...(inpData.options.headError !== undefined && {
    headError: inpData.options.headError,
  }),
  ...(inpData.options.flowChange !== undefined && {
    flowChange: inpData.options.flowChange,
  }),
  ...(inpData.options.checkFreq !== undefined && {
    checkFreq: inpData.options.checkFreq,
  }),
  ...(inpData.options.maxCheck !== undefined && {
    maxCheck: inpData.options.maxCheck,
  }),
  ...(inpData.options.dampLimit !== undefined && {
    dampLimit: inpData.options.dampLimit,
  }),
  ...(inpData.options.viscosity !== undefined && {
    viscosity: inpData.options.viscosity,
  }),
  ...(inpData.options.specificGravity !== undefined && {
    specificGravity: inpData.options.specificGravity,
  }),
  qualitySimulationType:
    inpData.options.qualitySimulationType ??
    defaultWaterQualityValues.qualitySimulationType,
  qualityChemicalName:
    inpData.options.qualityChemicalName ??
    defaultWaterQualityValues.qualityChemicalName,
  qualityMassUnit:
    inpData.options.qualityMassUnit ??
    defaultWaterQualityValues.qualityMassUnit,
  qualityTraceNodeId: resolveTraceNodeId(
    inpData.options.qualityTraceNode,
    hydraulicModel.assets,
  ),
  tolerance: inpData.options.tolerance ?? defaultWaterQualityValues.tolerance,
  diffusivity:
    inpData.options.diffusivity ?? defaultWaterQualityValues.diffusivity,
  reactionBulkOrder:
    inpData.reactions.bulkOrder ?? defaultWaterQualityValues.reactionBulkOrder,
  reactionWallOrder:
    inpData.reactions.wallOrder ?? defaultWaterQualityValues.reactionWallOrder,
  reactionTankOrder:
    inpData.reactions.tankOrder ?? defaultWaterQualityValues.reactionTankOrder,
  reactionGlobalBulk:
    inpData.reactions.globalBulk ??
    defaultWaterQualityValues.reactionGlobalBulk,
  reactionGlobalWall:
    inpData.reactions.globalWall ??
    defaultWaterQualityValues.reactionGlobalWall,
  reactionLimitingPotential:
    inpData.reactions.limitingPotential ??
    defaultWaterQualityValues.reactionLimitingPotential,
  reactionRoughnessCorrelation:
    inpData.reactions.roughnessCorrelation ??
    defaultWaterQualityValues.reactionRoughnessCorrelation,
  reportEnergy: inpData.report.energy ?? defaultEnergyValues.reportEnergy,
  energyGlobalEfficiency:
    inpData.energy.globalEfficiency ??
    defaultEnergyValues.energyGlobalEfficiency,
  energyGlobalPrice:
    inpData.energy.globalPrice ?? defaultEnergyValues.energyGlobalPrice,
  energyGlobalPatternId: resolveEnergyPatternId(
    inpData.energy.globalPattern,
    hydraulicModel,
  ),
  energyDemandCharge:
    inpData.energy.demandCharge ?? defaultEnergyValues.energyDemandCharge,
  statusReport: inpData.report.statusReport ?? defaultReportValues.statusReport,
});
