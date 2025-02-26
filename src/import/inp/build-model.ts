import { HydraulicModel, initializeHydraulicModel } from "src/hydraulic-model";
import { InpData } from "./inp-data";
import { IssuesAccumulator } from "./issues";
import { ModelMetadata } from "src/model-metadata";
import { Quantities, presets } from "src/model-metadata/quantities-spec";
import { Position } from "geojson";
import { isFeatureOn } from "src/infra/feature-flags";
import { normalizeRef } from "./row-parsers";

export const buildModel = (
  inpData: InpData,
  issues: IssuesAccumulator,
): { hydraulicModel: HydraulicModel; modelMetadata: ModelMetadata } => {
  const spec = presets[inpData.options.units];
  const quantities = new Quantities(spec);
  const hydraulicModel = initializeHydraulicModel({
    units: quantities.units,
    defaults: quantities.defaults,
    headlossFormula: inpData.options.headlossFormula,
  });

  for (const junctionData of inpData.junctions) {
    if (isFeatureOn("FLAG_UNIQUE_IDS")) {
      const coordinates = getNodeCoordinates(inpData, junctionData.id, issues);
      if (!coordinates) continue;

      const demand = calculateJunctionDemand(
        junctionData,
        inpData.demands,
        inpData.patterns,
      );

      const junction = hydraulicModel.assetBuilder.buildJunction({
        id: junctionData.id,
        label: junctionData.id,
        coordinates,
        elevation: junctionData.elevation,
        demand,
      });
      hydraulicModel.assets.set(junction.id, junction);
    } else {
      const coordinates = getNodeCoordinatesDeprecated(
        inpData,
        junctionData.id,
        issues,
      );
      if (!coordinates) continue;

      const demand = calculateJunctionDemandDeprecated(
        junctionData,
        inpData.demands,
        inpData.patterns,
      );
      const junction = hydraulicModel.assetBuilder.buildJunction({
        id: junctionData.id,
        coordinates,
        elevation: junctionData.elevation,
        demand,
      });
      hydraulicModel.assets.set(junction.id, junction);
    }
  }

  for (const reservoirData of inpData.reservoirs) {
    const coordinates = getNodeCoordinatesDeprecated(
      inpData,
      reservoirData.id,
      issues,
    );
    if (!coordinates) continue;

    const reservoir = hydraulicModel.assetBuilder.buildReservoir({
      id: reservoirData.id,
      coordinates,
      head: calculateReservoirHead(reservoirData, inpData.patterns),
    });
    hydraulicModel.assets.set(reservoir.id, reservoir);
  }

  for (const tankData of inpData.tanks) {
    const coordinates = getNodeCoordinatesDeprecated(
      inpData,
      tankData.id,
      issues,
    );
    if (!coordinates) continue;

    const reservoir = hydraulicModel.assetBuilder.buildReservoir({
      id: tankData.id,
      coordinates,
      head: tankData.elevation + tankData.initialLevel,
    });
    hydraulicModel.assets.set(tankData.id, reservoir);
  }

  for (const pipeData of inpData.pipes) {
    const startCoordinates = getNodeCoordinatesDeprecated(
      inpData,
      pipeData.startNode,
      issues,
    );
    const endCoordinates = getNodeCoordinatesDeprecated(
      inpData,
      pipeData.endNode,
      issues,
    );
    const vertices = getVertices(inpData, pipeData.id, issues);
    if (!startCoordinates || !endCoordinates) continue;

    const pipe = hydraulicModel.assetBuilder.buildPipe({
      id: pipeData.id,
      length: pipeData.length,
      diameter: pipeData.diameter,
      minorLoss: pipeData.minorLoss,
      roughness: pipeData.roughness,
      connections: [pipeData.startNode, pipeData.endNode],
      status: pipeData.status,
      coordinates: [startCoordinates, ...vertices, endCoordinates],
    });
    hydraulicModel.assets.set(pipe.id, pipe);
    hydraulicModel.topology.addLink(
      pipe.id,
      pipeData.startNode,
      pipeData.endNode,
    );
  }

  return { hydraulicModel, modelMetadata: { quantities } };
};

const getVertices = (
  inpData: InpData,
  linkId: string,
  issues: IssuesAccumulator,
) => {
  const candidates = inpData.vertices[linkId] || [];
  const vertices = candidates.filter((coordinates) => isWgs84(coordinates));
  if (candidates.length !== vertices.length) {
    issues.addInvalidVertices(linkId);
    return [];
  }
  return vertices;
};

const getNodeCoordinates = (
  inpData: InpData,
  nodeId: string,
  issues: IssuesAccumulator,
): Position | null => {
  const nodeRef = normalizeRef(nodeId);
  const nodeCoordinates = inpData.coordinates[nodeRef];
  if (!nodeCoordinates) {
    issues.addMissingCoordinates(nodeId);
    return null;
  }
  if (!isWgs84(nodeCoordinates)) {
    issues.addInvalidCoordinates(nodeId);
    return null;
  }
  return nodeCoordinates;
};

const getNodeCoordinatesDeprecated = (
  inpData: InpData,
  nodeId: string,
  issues: IssuesAccumulator,
): Position | null => {
  const nodeCoordinates = inpData.coordinates[nodeId];
  if (!nodeCoordinates) {
    issues.addMissingCoordinates(nodeId);
    return null;
  }
  if (!isWgs84(nodeCoordinates)) {
    issues.addInvalidCoordinates(nodeId);
    return null;
  }
  return nodeCoordinates;
};

const isWgs84 = (coordinates: Position) =>
  coordinates[0] >= -180 &&
  coordinates[0] <= 180 &&
  coordinates[1] >= -90 &&
  coordinates[1] <= 90;

const defaultPatternId = "1";

const getPatternDeprecated = (
  patterns: InpData["patterns"],
  patternId: string | undefined,
): number[] => {
  return patterns[patternId || defaultPatternId] || [1];
};

const getPattern = (
  patterns: InpData["patterns"],
  patternId: string | undefined,
): number[] => {
  const patternRef = patternId ? normalizeRef(patternId) : defaultPatternId;
  return patterns[patternRef] || [1];
};

const calculateJunctionDemand = (
  junction: { id: string; baseDemand?: number; patternId?: string },
  demands: InpData["demands"],
  patterns: InpData["patterns"],
): number => {
  let demand = 0;

  const junctionRef = normalizeRef(junction.id);
  const junctionDemands = demands[junctionRef] || [];
  if (!!junctionDemands.length) {
    junctionDemands.forEach(({ baseDemand, patternId }) => {
      const pattern = getPattern(patterns, patternId);
      demand += baseDemand * pattern[0];
    });
  } else {
    if (junction.baseDemand) {
      const pattern = getPattern(patterns, junction.patternId);
      demand += junction.baseDemand * pattern[0];
    }
  }

  return demand;
};

const calculateJunctionDemandDeprecated = (
  junction: { id: string; baseDemand?: number; patternId?: string },
  demands: InpData["demands"],
  patterns: InpData["patterns"],
): number => {
  let demand = 0;

  const junctionDemands = demands[junction.id] || [];
  if (!!junctionDemands.length) {
    junctionDemands.forEach(({ baseDemand, patternId }) => {
      const pattern = getPatternDeprecated(patterns, patternId);
      demand += baseDemand * pattern[0];
    });
  } else {
    if (junction.baseDemand) {
      const pattern = getPatternDeprecated(patterns, junction.patternId);
      demand += junction.baseDemand * pattern[0];
    }
  }

  return demand;
};

const calculateReservoirHead = (
  reservoir: { id: string; baseHead: number; patternId?: string },
  patterns: InpData["patterns"],
): number => {
  let head = reservoir.baseHead;
  if (reservoir.patternId) {
    const pattern = getPatternDeprecated(patterns, reservoir.patternId);
    head = reservoir.baseHead * pattern[0];
  }
  return head;
};
