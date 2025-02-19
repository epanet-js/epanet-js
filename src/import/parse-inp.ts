import { Position } from "geojson";
import { HydraulicModel } from "src/hydraulic-model";
import {
  HeadlossFormula,
  PipeStatus,
} from "src/hydraulic-model/asset-types/pipe";
import { initializeHydraulicModel } from "src/hydraulic-model/hydraulic-model";
import { isFeatureOn } from "src/infra/feature-flags";
import { ModelMetadata } from "src/model-metadata";
import { Quantities, presets } from "src/model-metadata/quantities-spec";
import { EpanetUnitSystem } from "src/simulation/build-inp";

const epanetSections = [
  "[TITLE]",
  "[CURVES]",
  "[QUALITY]",
  "[OPTIONS]",
  "[BACKDROP]",
  "[JUNCTIONS]",
  "[PATTERNS]",
  "[REACTIONS]",
  "[TIMES]",
  "[COORDINATES]",
  "[RESERVOIRS]",
  "[ENERGY]",
  "[SOURCES]",
  "[REPORT]",
  "[VERTICES]",
  "[TANKS]",
  "[STATUS]",
  "[MIXING]",
  "[LABELS]",
  "[PIPES]",
  "[CONTROLS]",
  "[PUMPS]",
  "[RULES]",
  "[VALVES]",
  "[DEMANDS]",
  "[EMITTERS]",
];

type InpData = {
  junctions: { id: string; elevation: number }[];
  reservoirs: { id: string; head: number }[];
  tanks: {
    id: string;
    elevation: number;
    initialLevel: number;
    minimumLevel: number;
    maximumLevel: number;
    diameter: number;
    minimumVolume: number;
  }[];
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
  options: { units: EpanetUnitSystem; headlossFormula: HeadlossFormula };
};

export type ParserIssues = {
  unsupportedSections: Set<string>;
  extendedPeriodSimulation: boolean;
  patternStartNotInZero: boolean;
};

export const parseInp = (
  inp: string,
): {
  hydraulicModel: HydraulicModel;
  modelMetadata: ModelMetadata;
  hasUnsupported: boolean;
  issues: ParserIssues;
} => {
  if (isFeatureOn("FLAG_UNSUPPORTED")) {
    const { inpData, issues } = readAllSections(inp);
    return {
      ...buildModel(inpData),
      issues,
      hasUnsupported: issues.unsupportedSections.size > 0,
    };
  } else {
    const dummyParserIssues = {
      unsupportedSections: new Set<string>(),
      extendedPeriodSimulation: false,
      patternStartNotInZero: false,
    };
    const { inpData, hasUnsupported } = readAllSectionsDeprecated(inp);
    return {
      ...buildModel(inpData),
      hasUnsupported,
      issues: dummyParserIssues,
    };
  }
};

const detectNewSectionName = (trimmedRow: string): string | null => {
  if (!trimmedRow.startsWith("[")) return null;
  const sectionName = epanetSections.find((name) => trimmedRow.includes(name));
  return sectionName || null;
};

const readAllSections = (
  inp: string,
): { inpData: InpData; issues: ParserIssues } => {
  const rows = inp.split("\n");
  let section = null;
  const inpData: InpData = {
    junctions: [],
    reservoirs: [],
    tanks: [],
    pipes: [],
    coordinates: {},
    vertices: {},
    demands: {},
    options: { units: "GPM", headlossFormula: "H-W" },
  };
  const issues: ParserIssues = {
    unsupportedSections: new Set<string>(),
    extendedPeriodSimulation: false,
    patternStartNotInZero: false,
  };

  for (const row of rows) {
    const trimmedRow = row.trim();

    if (trimmedRow.startsWith(";")) continue;
    if (trimmedRow === "" || trimmedRow.includes("[END]")) {
      section = null;
      continue;
    }

    const newSectionName = detectNewSectionName(trimmedRow);
    if (newSectionName) {
      section = newSectionName.toLowerCase().replace("[", "").replace("]", "");
      continue;
    }
    if (trimmedRow.startsWith("[")) {
      section = "unsupported";
      continue;
    }

    if (section === "junctions") {
      const [id, elevation] = readValues(trimmedRow);

      inpData.junctions.push({ id, elevation: parseFloat(elevation) });
      continue;
    }

    if (section === "reservoirs") {
      const [id, head] = readValues(trimmedRow);

      inpData.reservoirs.push({ id, head: parseFloat(head) });
      continue;
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
      ] = readValues(trimmedRow);

      inpData.pipes.push({
        id,
        startNode,
        endNode,
        length: parseFloat(length),
        diameter: parseFloat(diameter),
        roughness: parseFloat(roughness),
        minorLoss: parseFloat(minorLoss),
        status: status.toLowerCase() === "open" ? "open" : "closed",
      });
      continue;
    }

    if (section === "coordinates") {
      const [nodeId, lng, lat] = readValues(trimmedRow);
      inpData.coordinates[nodeId] = [parseFloat(lng), parseFloat(lat)];
      continue;
    }

    if (section === "vertices") {
      const [linkId, lng, lat] = readValues(trimmedRow);
      if (!inpData.vertices[linkId]) inpData.vertices[linkId] = [];

      inpData.vertices[linkId].push([parseFloat(lng), parseFloat(lat)]);
      continue;
    }

    if (section === "demands") {
      const [nodeId, demand] = readValues(trimmedRow);
      inpData.demands[nodeId] = parseFloat(demand);
      continue;
    }

    if (section === "options") {
      const [name, value] = readValues(trimmedRow);
      if (name === "Units") inpData.options.units = value as EpanetUnitSystem;
      if (name === "Headloss")
        inpData.options.headlossFormula = value as HeadlossFormula;
      continue;
    }
    if (section === "report") {
      continue;
    }
    if (section === "times") {
      const [name, value] = readValues(trimmedRow);
      if (name === "Duration" && parseInt(value) !== 0) {
        issues.extendedPeriodSimulation = true;
      }
      if (name === "Pattern Start" && value !== "00:00") {
        issues.patternStartNotInZero = true;
      }
      continue;
    }
    if (section === "title") {
      continue;
    }

    if (section !== null) {
      issues.unsupportedSections.add(section);
    }
  }
  return { inpData, issues };
};

const readAllSectionsDeprecated = (
  inp: string,
): { inpData: InpData; hasUnsupported: boolean } => {
  const rows = inp.split("\n");
  let section = null;
  const inpData: InpData = {
    junctions: [],
    reservoirs: [],
    tanks: [],
    pipes: [],
    coordinates: {},
    vertices: {},
    demands: {},
    options: { units: "GPM", headlossFormula: "H-W" },
  };
  let hasUnsupported = false;
  for (const row of rows) {
    const trimmedRow = row.trim();

    if (trimmedRow.startsWith(";")) continue;
    if (trimmedRow === "" || trimmedRow.includes("[END]")) {
      section = null;
      continue;
    }

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
    if (trimmedRow.includes("[TIMES]")) {
      section = "times";
      continue;
    }
    if (trimmedRow.includes("[REPORT]")) {
      section = "report";
      continue;
    }
    if (trimmedRow.includes("[OPTIONS]")) {
      section = "options";
      continue;
    }
    if (trimmedRow.startsWith("[")) {
      section = "unsupported";
      continue;
    }

    if (section === "junctions") {
      const [id, elevation] = readValues(trimmedRow);

      inpData.junctions.push({ id, elevation: parseFloat(elevation) });
    }

    if (section === "reservoir") {
      const [id, head] = readValues(trimmedRow);

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
      ] = readValues(trimmedRow);

      inpData.pipes.push({
        id,
        startNode,
        endNode,
        length: parseFloat(length),
        diameter: parseFloat(diameter),
        roughness: parseFloat(roughness),
        minorLoss: parseFloat(minorLoss),
        status: status.toLowerCase() === "open" ? "open" : "closed",
      });
    }

    if (section === "coordinates") {
      const [nodeId, lng, lat] = readValues(trimmedRow);
      inpData.coordinates[nodeId] = [parseFloat(lng), parseFloat(lat)];
    }

    if (section === "vertices") {
      const [linkId, lng, lat] = readValues(trimmedRow);
      if (!inpData.vertices[linkId]) inpData.vertices[linkId] = [];

      inpData.vertices[linkId].push([parseFloat(lng), parseFloat(lat)]);
    }

    if (section === "demands") {
      const [nodeId, demand] = readValues(trimmedRow);
      inpData.demands[nodeId] = parseFloat(demand);
    }

    if (section === "options") {
      const [name, value] = readValues(trimmedRow);
      if (name === "Units") inpData.options.units = value as EpanetUnitSystem;
      if (name === "Headloss")
        inpData.options.headlossFormula = value as HeadlossFormula;
    }

    if (section === "unsupported") {
      hasUnsupported = true;
    }
  }
  return { inpData, hasUnsupported };
};

const buildModel = (
  inpData: InpData,
): { hydraulicModel: HydraulicModel; modelMetadata: ModelMetadata } => {
  const spec =
    inpData.options.units === "GPM" ? presets.usCustomary : presets.lps;
  const quantities = new Quantities(spec);
  const hydraulicModel = initializeHydraulicModel({
    units: quantities.units,
    defaults: quantities.defaults,
    headlossFormula: inpData.options.headlossFormula,
  });

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
      connections: [pipeData.startNode, pipeData.endNode],
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

  return { hydraulicModel, modelMetadata: { quantities } };
};

const readValues = (row: string): string[] => {
  const rowWithoutComments = row.split(";")[0];
  return rowWithoutComments.split("\t").map((s) => s.trim());
};
