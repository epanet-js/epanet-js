import { Position } from "geojson";
import { HydraulicModel, nullHydraulicModel } from "src/hydraulic-model";

type InpData = {
  junctions: { id: string; elevation: number }[];
  coordinates: Record<string, Position>;
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
  return hydraulicModel;
};

const readAllSections = (inp: string): InpData => {
  const rows = inp.split("\n");
  let section = null;
  const inpData: InpData = {
    junctions: [],
    coordinates: {},
    demands: {},
  };
  for (const row of rows) {
    const trimmedRow = row.trim();
    if (trimmedRow.includes("[JUNCTIONS]")) {
      section = "junctions";
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

    if (section === "junctions") {
      const [id, elevation] = trimmedRow.split("\t");

      inpData.junctions.push({ id, elevation: parseFloat(elevation) });
    }

    if (section === "coordinates") {
      const [nodeId, lng, lat] = trimmedRow.split("\t");
      inpData.coordinates[nodeId] = [parseFloat(lng), parseFloat(lat)];
    }

    if (section === "demands") {
      const [nodeId, demand] = trimmedRow.split("\t");
      inpData.demands[nodeId] = parseFloat(demand);
    }
  }
  return inpData;
};
