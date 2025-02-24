import { HydraulicModel, initializeHydraulicModel } from "src/hydraulic-model";
import { InpData } from "./inp-data";
import { IssuesAccumulator } from "./issues";
import { ModelMetadata } from "src/model-metadata";
import {
  AssetQuantitiesSpec,
  Quantities,
  presets,
} from "src/model-metadata/quantities-spec";
import { Position } from "geojson";

export const buildModel = (
  inpData: InpData,
  issues: IssuesAccumulator,
): { hydraulicModel: HydraulicModel; modelMetadata: ModelMetadata } => {
  let spec: AssetQuantitiesSpec;
  spec = presets[inpData.options.units];
  const quantities = new Quantities(spec);
  const hydraulicModel = initializeHydraulicModel({
    units: quantities.units,
    defaults: quantities.defaults,
    headlossFormula: inpData.options.headlossFormula,
  });

  for (const junctionData of inpData.junctions) {
    const coordinates = getNodeCoordinates(inpData, junctionData.id, issues);
    if (!coordinates) continue;

    const junction = hydraulicModel.assetBuilder.buildJunction({
      id: junctionData.id,
      coordinates,
      elevation: junctionData.elevation,
      demand: inpData.demands[junctionData.id],
    });
    hydraulicModel.assets.set(junction.id, junction);
  }

  for (const reservoirData of inpData.reservoirs) {
    const coordinates = getNodeCoordinates(inpData, reservoirData.id, issues);
    if (!coordinates) continue;

    const reservoir = hydraulicModel.assetBuilder.buildReservoir({
      id: reservoirData.id,
      coordinates,
      head: reservoirData.head,
    });
    hydraulicModel.assets.set(reservoir.id, reservoir);
  }

  for (const pipeData of inpData.pipes) {
    const startCoordinates = getNodeCoordinates(
      inpData,
      pipeData.startNode,
      issues,
    );
    const endCoordinates = getNodeCoordinates(
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
