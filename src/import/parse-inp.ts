import { Position } from "geojson";
import { HydraulicModel, nullHydraulicModel } from "src/hydraulic-model";
import { PipeStatus } from "src/hydraulic-model/asset-types/pipe";

type InpData = {
  junctions: { id: string; elevation: number }[];
  reservoirs: { id: string; head: number }[];
  pipes: {
    id: string;
    startNode: string;
    endNode: string;
    length: number;
    diameter: number;
    roughness: number;
    minorLoss: number;
    status: PipeStatus;
  }[];
  coordinates: Record<string, Position>;
  vertices: Record<string, Position[]>;
  demands: Record<string, number>;
};

export const parseInp = (inp: string): HydraulicModel => {
  const hydraulicModel = nullHydraulicModel(new Map());

  const inpData = readAllSections(inp);

  for (const junctionData of inpData.junctions) {
    const junction = hydraulicModel.assetBuilder.buildJunction({
      id: junctionData.id,
      coordinates: inpData.coordinates[junctionData.id],
      elevation: junctionData.elevation,
      demand: inpData.demands[junctionData.id],
    });
    hydraulicModel.assets.set(junction.id, junction);
  }

  for (const reservoirData of inpData.reservoirs) {
    const reservoir = hydraulicModel.assetBuilder.buildReservoir({
      id: reservoirData.id,
      coordinates: inpData.coordinates[reservoirData.id],
      head: reservoirData.head,
    });
    hydraulicModel.assets.set(reservoir.id, reservoir);
  }

  for (const pipeData of inpData.pipes) {
    const pipe = hydraulicModel.assetBuilder.buildPipe({
      id: pipeData.id,
      length: pipeData.length,
      diameter: pipeData.diameter,
      minorLoss: pipeData.minorLoss,
      roughness: pipeData.roughness,
      status: pipeData.status,
      coordinates: [
        inpData.coordinates[pipeData.startNode],
        ...(inpData.vertices[pipeData.id] || []),
        inpData.coordinates[pipeData.endNode],
      ],
    });
    hydraulicModel.assets.set(pipe.id, pipe);
    hydraulicModel.topology.addLink(
      pipe.id,
      pipeData.startNode,
      pipeData.endNode,
    );
  }
  return hydraulicModel;
};

const readAllSections = (inp: string): InpData => {
  const rows = inp.split("\n");
  let section = null;
  const inpData: InpData = {
    junctions: [],
    reservoirs: [],
    pipes: [],
    coordinates: {},
    vertices: {},
    demands: {},
  };
  for (const row of rows) {
    const trimmedRow = row.trim();

    if (trimmedRow === "" || trimmedRow.startsWith(";")) continue;

    if (trimmedRow.includes("[JUNCTIONS]")) {
      section = "junctions";
      continue;
    }
    if (trimmedRow.includes("[RESERVOIRS]")) {
      section = "reservoir";
      continue;
    }
    if (trimmedRow.includes("[COORDINATES]")) {
      section = "coordinates";
      continue;
    }
    if (trimmedRow.includes("[DEMANDS]")) {
      section = "demands";
      continue;
    }
    if (trimmedRow.includes("[PIPES]")) {
      section = "pipes";
      continue;
    }
    if (trimmedRow.includes("[VERTICES]")) {
      section = "vertices";
      continue;
    }

    if (section === "junctions") {
      const [id, elevation] = trimmedRow.split("\t");

      inpData.junctions.push({ id, elevation: parseFloat(elevation) });
    }

    if (section === "reservoir") {
      const [id, head] = trimmedRow.split("\t");

      inpData.reservoirs.push({ id, head: parseFloat(head) });
    }

    if (section === "pipes") {
      const [
        id,
        startNode,
        endNode,
        length,
        diameter,
        roughness,
        minorLoss,
        status,
      ] = trimmedRow.split("\t");

      inpData.pipes.push({
        id,
        startNode,
        endNode,
        length: parseFloat(length),
        diameter: parseFloat(diameter),
        roughness: parseFloat(roughness),
        minorLoss: parseFloat(minorLoss),
        status: status === "Open" ? "open" : "closed",
      });
    }

    if (section === "coordinates") {
      const [nodeId, lng, lat] = trimmedRow.split("\t");
      inpData.coordinates[nodeId] = [parseFloat(lng), parseFloat(lat)];
    }

    if (section === "vertices") {
      const [linkId, lng, lat] = trimmedRow.split("\t");
      if (!inpData.vertices[linkId]) inpData.vertices[linkId] = [];

      inpData.vertices[linkId].push([parseFloat(lng), parseFloat(lat)]);
    }

    if (section === "demands") {
      const [nodeId, demand] = trimmedRow.split("\t");
      inpData.demands[nodeId] = parseFloat(demand);
    }
  }
  return inpData;
};
