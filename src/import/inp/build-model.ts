import { HydraulicModel, initializeHydraulicModel } from "src/hydraulic-model";
import {
  InpData,
  ItemData,
  JunctionData,
  PipeData,
  PumpData,
  ReservoirData,
  TankData,
} from "./inp-data";
import { IssuesAccumulator } from "./issues";
import { ModelMetadata } from "src/model-metadata";
import { Quantities, presets } from "src/model-metadata/quantities-spec";
import { Position } from "geojson";
import { PumpStatus } from "src/hydraulic-model/asset-types/pump";

export const buildModel = (
  inpData: InpData,
  issues: IssuesAccumulator,
): { hydraulicModel: HydraulicModel; modelMetadata: ModelMetadata } => {
  const spec = presets[inpData.options.units];
  const quantities = new Quantities(spec);
  const nodeIds = new ItemData<string>();
  const hydraulicModel = initializeHydraulicModel({
    units: quantities.units,
    defaults: quantities.defaults,
    headlossFormula: inpData.options.headlossFormula,
  });

  for (const junctionData of inpData.junctions) {
    addJunction(hydraulicModel, junctionData, { inpData, issues, nodeIds });
  }

  for (const reservoirData of inpData.reservoirs) {
    addReservoir(hydraulicModel, reservoirData, {
      inpData,
      issues,
      nodeIds,
    });
  }

  for (const tankData of inpData.tanks) {
    addTankAsReservoir(hydraulicModel, tankData, {
      inpData,
      issues,
      nodeIds,
    });
  }

  for (const pumpData of inpData.pumps) {
    addPump(hydraulicModel, pumpData, {
      inpData,
      issues,
      nodeIds,
    });
  }

  for (const pipeData of inpData.pipes) {
    addPipe(hydraulicModel, pipeData, { inpData, issues, nodeIds });
  }

  return { hydraulicModel, modelMetadata: { quantities } };
};

const addJunction = (
  hydraulicModel: HydraulicModel,
  junctionData: JunctionData,
  {
    inpData,
    issues,
    nodeIds,
  }: {
    inpData: InpData;
    issues: IssuesAccumulator;
    nodeIds: ItemData<string>;
  },
) => {
  const coordinates = getNodeCoordinates(inpData, junctionData.id, issues);
  if (!coordinates) return;

  const demand = calculateJunctionDemand(
    junctionData,
    inpData.demands,
    inpData.patterns,
  );

  const junction = hydraulicModel.assetBuilder.buildJunction({
    label: junctionData.id,
    coordinates,
    elevation: junctionData.elevation,
    demand,
  });
  hydraulicModel.assets.set(junction.id, junction);
  nodeIds.set(junctionData.id, junction.id);
};

const addReservoir = (
  hydraulicModel: HydraulicModel,
  reservoirData: ReservoirData,
  {
    inpData,
    issues,
    nodeIds,
  }: {
    inpData: InpData;
    issues: IssuesAccumulator;
    nodeIds: ItemData<string>;
  },
) => {
  const coordinates = getNodeCoordinates(inpData, reservoirData.id, issues);
  if (!coordinates) return;

  const reservoir = hydraulicModel.assetBuilder.buildReservoir({
    label: reservoirData.id,
    coordinates,
    head: calculateReservoirHead(reservoirData, inpData.patterns),
  });
  hydraulicModel.assets.set(reservoir.id, reservoir);
  nodeIds.set(reservoirData.id, reservoir.id);
};

const addTankAsReservoir = (
  hydraulicModel: HydraulicModel,
  tankData: TankData,
  {
    inpData,
    issues,
    nodeIds,
  }: {
    inpData: InpData;
    issues: IssuesAccumulator;
    nodeIds: ItemData<string>;
  },
) => {
  const coordinates = getNodeCoordinates(inpData, tankData.id, issues);
  if (!coordinates) return;

  const reservoir = hydraulicModel.assetBuilder.buildReservoir({
    label: tankData.id,
    coordinates,
    head: tankData.elevation + tankData.initialLevel,
  });
  hydraulicModel.assets.set(reservoir.id, reservoir);
  nodeIds.set(tankData.id, reservoir.id);
};

const addPump = (
  hydraulicModel: HydraulicModel,
  pumpData: PumpData,
  {
    inpData,
    issues,
    nodeIds,
  }: {
    inpData: InpData;
    issues: IssuesAccumulator;
    nodeIds: ItemData<string>;
  },
) => {
  const linkProperties = getLinkProperties(inpData, issues, nodeIds, pumpData);
  if (!linkProperties) return;

  const { coordinates, connections } = linkProperties;

  let definitionProps = {};

  if (pumpData.power !== undefined) {
    definitionProps = {
      definitionType: "power",
      power: pumpData.power,
    };
  }

  if (pumpData.curveId !== undefined) {
    const curvePoints = inpData.curves.get(pumpData.curveId) || [];

    if (curvePoints.length > 1) {
      issues.addUsedSection("[CURVES]");
    }

    const middleIndex = Math.floor(curvePoints.length / 2);
    const point = curvePoints[middleIndex];

    if (point) {
      definitionProps = {
        definitionType: "flow-vs-head",
        designFlow: point.x,
        designHead: point.y,
      };
    }
  }

  let initialStatus: PumpStatus = "on";
  let speed = pumpData.speed !== undefined ? pumpData.speed : 1;

  if (inpData.status.has(pumpData.id)) {
    const statusValue = inpData.status.get(pumpData.id) as string;
    if (statusValue === "CLOSED") {
      initialStatus = "off";
    } else if (statusValue === "OPEN") {
      initialStatus = "on";
      speed = 1;
    } else if (!isNaN(parseFloat(statusValue))) {
      speed = parseFloat(statusValue);
    }
  }

  if (pumpData.patternId) {
    const pattern = getPattern(inpData.patterns, pumpData.patternId);
    speed = pattern[0];
  }

  const pump = hydraulicModel.assetBuilder.buildPump({
    label: pumpData.id,
    connections,
    ...definitionProps,
    initialStatus,
    speed,
    coordinates,
  });
  hydraulicModel.assets.set(pump.id, pump);
  hydraulicModel.topology.addLink(pump.id, connections[0], connections[1]);
};

const addPipe = (
  hydraulicModel: HydraulicModel,
  pipeData: PipeData,
  {
    inpData,
    issues,
    nodeIds,
  }: {
    inpData: InpData;
    issues: IssuesAccumulator;
    nodeIds: ItemData<string>;
  },
) => {
  const linkProperties = getLinkProperties(inpData, issues, nodeIds, pipeData);
  if (!linkProperties) return;
  const { connections, coordinates } = linkProperties;

  let status = pipeData.status;

  if (inpData.status.has(pipeData.id)) {
    const statusValue = inpData.status.get(pipeData.id) as string;
    status = statusValue === "CLOSED" ? "closed" : "open";
  }

  const pipe = hydraulicModel.assetBuilder.buildPipe({
    label: pipeData.id,
    length: pipeData.length,
    diameter: pipeData.diameter,
    minorLoss: pipeData.minorLoss,
    roughness: pipeData.roughness,
    status,
    connections,
    coordinates,
  });
  hydraulicModel.assets.set(pipe.id, pipe);
  hydraulicModel.topology.addLink(pipe.id, connections[0], connections[1]);
};

const getLinkProperties = (
  inpData: InpData,
  issues: IssuesAccumulator,
  nodeIds: ItemData<string>,
  linkData: { id: string; startNodeDirtyId: string; endNodeDirtyId: string },
) => {
  const startCoordinates = getNodeCoordinates(
    inpData,
    linkData.startNodeDirtyId,
    issues,
  );
  const endCoordinates = getNodeCoordinates(
    inpData,
    linkData.endNodeDirtyId,
    issues,
  );
  const vertices = getVertices(inpData, linkData.id, issues);

  if (!startCoordinates || !endCoordinates) return null;

  const startNodeId = nodeIds.get(linkData.startNodeDirtyId);
  const endNodeId = nodeIds.get(linkData.endNodeDirtyId);

  if (!startNodeId || !endNodeId) return null;

  return {
    coordinates: [startCoordinates, ...vertices, endCoordinates],
    connections: [startNodeId, endNodeId] as [string, string],
  };
};

const getVertices = (
  inpData: InpData,
  linkId: string,
  issues: IssuesAccumulator,
) => {
  const candidates = inpData.vertices.get(linkId) || [];
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
  const nodeCoordinates = inpData.coordinates.get(nodeId);
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

const getPattern = (
  patterns: InpData["patterns"],
  patternId: string | undefined,
): number[] => {
  return patterns.get(patternId || defaultPatternId) || [1];
};

const calculateJunctionDemand = (
  junction: { id: string; baseDemand?: number; patternId?: string },
  demands: InpData["demands"],
  patterns: InpData["patterns"],
): number => {
  let demand = 0;

  const junctionDemands = demands.get(junction.id) || [];
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

const calculateReservoirHead = (
  reservoir: { id: string; baseHead: number; patternId?: string },
  patterns: InpData["patterns"],
): number => {
  let head = reservoir.baseHead;
  if (reservoir.patternId) {
    const pattern = getPattern(patterns, reservoir.patternId);
    head = reservoir.baseHead * pattern[0];
  }
  return head;
};
