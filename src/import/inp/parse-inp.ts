import { ModelMetadata } from "src/model-metadata";
import { IssuesAccumulator, ParserIssues } from "./issues";
import { readInpData } from "./read-inp-data";
import { buildModel } from "./build-model";
import { HydraulicModel, AssetsMap } from "src/hydraulic-model";
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
  Projection,
  ProjectionMapper,
  buildProjectionMapper,
} from "src/projections";

export type ParseInpOptions = {
  customerPoints?: boolean;
  inactiveAssets?: boolean;
  sourceProjection?: Projection;
  allCurves?: boolean;
};

export const parseInp = (
  inp: string,
  options?: ParseInpOptions,
): {
  isMadeByApp: boolean;
  hydraulicModel: HydraulicModel;
  factories: ModelFactories;
  modelMetadata: ModelMetadata;
  simulationSettings: SimulationSettings;
  issues: ParserIssues | null;
  stats: InpStats;
} => {
  const issues = new IssuesAccumulator();
  const header = parseHeader(inp);

  const safeOptions: ParseInpOptions = {
    ...options,
    customerPoints: header.isMadeByApp ? options?.customerPoints : false,
    inactiveAssets: header.isMadeByApp ? options?.inactiveAssets : false,
  };

  const { inpData, stats } = readInpData(inp, issues, safeOptions);

  const sourceProjection: Projection =
    header.sourceProjection ?? options?.sourceProjection ?? "wgs84";

  const projectionMapper = projectCoordinates(inpData, sourceProjection);

  const { hydraulicModel, factories, modelMetadata } = buildModel(
    inpData,
    issues,
    safeOptions,
  );
  return {
    isMadeByApp: header.isMadeByApp,
    hydraulicModel,
    factories,
    modelMetadata: {
      ...modelMetadata,
      projectionMapper,
    },
    simulationSettings: {
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
      tolerance:
        inpData.options.tolerance ?? defaultWaterQualityValues.tolerance,
      diffusivity:
        inpData.options.diffusivity ?? defaultWaterQualityValues.diffusivity,
      reactionBulkOrder:
        inpData.reactions.bulkOrder ??
        defaultWaterQualityValues.reactionBulkOrder,
      reactionWallOrder:
        inpData.reactions.wallOrder ??
        defaultWaterQualityValues.reactionWallOrder,
      reactionTankOrder:
        inpData.reactions.tankOrder ??
        defaultWaterQualityValues.reactionTankOrder,
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
      statusReport:
        inpData.report.statusReport ?? defaultReportValues.statusReport,
    },
    issues: issues.buildResult(),
    stats,
  };
};

const projectCoordinates = (
  inpData: InpData,
  sourceProjection: Projection,
): ProjectionMapper => {
  if (sourceProjection === "wgs84") {
    return buildProjectionMapper("wgs84", () => []);
  }

  const getAllPoints = () => {
    const points: Position[] = [];
    for (const [, p] of inpData.coordinates.entries()) points.push(p);
    for (const [, verts] of inpData.vertices.entries()) points.push(...verts);
    return points;
  };

  const projectionMapper = buildProjectionMapper(
    sourceProjection,
    getAllPoints,
  );

  for (const [id, p] of inpData.coordinates.entries()) {
    inpData.coordinates.set(id, projectionMapper.toWgs84(p));
  }
  for (const [id, verts] of inpData.vertices.entries()) {
    inpData.vertices.set(id, verts.map(projectionMapper.toWgs84));
  }

  return projectionMapper;
};

type Header = { isMadeByApp: boolean; sourceProjection?: Projection };

const checksumRegexp = /\[([0-9A-Fa-f]{8})\]/;
const projectionRegexp = /^;PROJECTION\s+(\S+)/;

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

  const secondLineEnd = rest.indexOf("\n");
  if (secondLineEnd === -1) return { isMadeByApp: true };

  const secondLine = rest.substring(0, secondLineEnd);
  const projectionMatch = secondLine.match(projectionRegexp);
  const sourceProjection = projectionMatch
    ? (projectionMatch[1] as Projection)
    : undefined;

  return { isMadeByApp: true, sourceProjection };
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
