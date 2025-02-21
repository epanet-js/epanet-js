import { Position } from "geojson";
import { HydraulicModel } from "src/hydraulic-model";
import {
  HeadlossFormula,
  PipeStatus,
} from "src/hydraulic-model/asset-types/pipe";
import { initializeHydraulicModel } from "src/hydraulic-model/hydraulic-model";
import { ModelMetadata } from "src/model-metadata";
import { Quantities, presets } from "src/model-metadata/quantities-spec";
import {
  EpanetUnitSystem,
  defaultAccuracy,
  defaultUnbalanced,
} from "src/simulation/build-inp";

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

const epanetDefaultOptions = {
  UNITS: "CFS",
  HEADLOSS: "H-W",
  ACCURACY: 0.001,
  UNBALANCED: "STOP",
  "SPECIFIC GRAVITY": 1.0,
  VISCOSITY: 1.0,
  TRIALS: 40,
  PATTERN: 1,
  "DEMAND MULTIPLIER": 1.0,
  "EMITTER EXPONENT": 0.5,
  QUALITY: "NONE",
  DIFFUSIVITY: 1.0,
  TOLERANCE: 0.01,
  "TANK MIXING": "MIXED",
};

const defaultOptions = {
  ...epanetDefaultOptions,
  UNITS: "LPS",
  ACCURACY: defaultAccuracy,
  UNBALANCED: defaultUnbalanced,
};

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
  unsupportedSections?: Set<string>;
  extendedPeriodSimulation?: boolean;
  nodesMissingCoordinates?: Set<string>;
  invalidCoordinates?: Set<string>;
  invalidVertices?: Set<string>;
  nonDefaultOptions?: Map<string, string | number>;
  unbalancedDiff?: {
    defaultSetting: string;
    customSetting: string;
  };
};

class IssuesAccumulator {
  private issues: ParserIssues;

  constructor() {
    this.issues = {};
  }

  addUsedSection(sectionName: string) {
    if (!this.issues.unsupportedSections)
      this.issues.unsupportedSections = new Set<string>();

    this.issues.unsupportedSections.add(sectionName);
  }

  addUsedOption(optionName: string, defaultValue: number | string) {
    if (!this.issues.nonDefaultOptions)
      this.issues.nonDefaultOptions = new Map<string, string | number>();

    this.issues.nonDefaultOptions.set(optionName, defaultValue);
  }

  addEPS() {
    this.issues.extendedPeriodSimulation = true;
  }

  addMissingCoordinates(nodeId: string) {
    if (!this.issues.nodesMissingCoordinates)
      this.issues.nodesMissingCoordinates = new Set<string>();

    this.issues.nodesMissingCoordinates.add(nodeId);
  }

  addInvalidCoordinates(nodeId: string) {
    if (!this.issues.invalidCoordinates)
      this.issues.invalidCoordinates = new Set<string>();

    this.issues.invalidCoordinates.add(nodeId);
  }

  addInvalidVertices(linkId: string) {
    if (!this.issues.invalidVertices)
      this.issues.invalidVertices = new Set<string>();

    this.issues.invalidVertices.add(linkId);
  }

  hasUnbalancedDiff(customSetting: string, defaultSetting: string) {
    this.issues.unbalancedDiff = { customSetting, defaultSetting };
  }

  buildResult(): ParserIssues | null {
    if (Object.keys(this.issues).length === 0) return null;

    return this.issues;
  }
}

export const parseInp = (
  inp: string,
): {
  hydraulicModel: HydraulicModel;
  modelMetadata: ModelMetadata;
  issues: ParserIssues | null;
} => {
  const issues = new IssuesAccumulator();
  const inpData = readAllSections(inp, issues);
  const { hydraulicModel, modelMetadata } = buildModel(inpData, issues);
  return {
    hydraulicModel,
    modelMetadata,
    issues: issues.buildResult(),
  };
};

const detectNewSectionName = (trimmedRow: string): string | null => {
  if (!trimmedRow.startsWith("[")) return null;
  const sectionName = epanetSections.find((name) => trimmedRow.includes(name));
  return sectionName || null;
};

const readAllSections = (inp: string, issues: IssuesAccumulator): InpData => {
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
      if (!value) continue;
      const normalizedName = name.toUpperCase() as keyof typeof defaultOptions;
      if (normalizedName === "UNITS") {
        inpData.options.units = value as EpanetUnitSystem;
        continue;
      }
      if (normalizedName === "HEADLOSS") {
        inpData.options.headlossFormula = value as HeadlossFormula;
        continue;
      }

      if (normalizedName === "UNBALANCED") {
        const normalizedValue = value.toUpperCase();
        if (normalizedValue !== defaultUnbalanced) {
          issues.hasUnbalancedDiff(normalizedValue, defaultUnbalanced);
        }
        continue;
      }

      const defaultValue = defaultOptions[normalizedName];
      if (typeof defaultValue === "number") {
        if (parseFloat(value) !== defaultValue)
          issues.addUsedOption(normalizedName, defaultValue);
      } else {
        if (defaultValue !== value.toUpperCase())
          issues.addUsedOption(normalizedName, defaultValue);
      }
      continue;
    }
    if (section === "report") {
      continue;
    }
    if (section === "times") {
      const [name, value] = readValues(trimmedRow);
      const normalizedName = name.toUpperCase();
      if (normalizedName === "DURATION" && parseInt(value) !== 0) {
        issues.addEPS();
      }
      continue;
    }
    if (section === "title") {
      continue;
    }

    if (section !== null) {
      issues.addUsedSection(section);
    }
  }

  return inpData;
};

const buildModel = (
  inpData: InpData,
  issues: IssuesAccumulator,
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

const readValues = (row: string): string[] => {
  const rowWithoutComments = row.split(";")[0];
  return rowWithoutComments.split("\t").map((s) => s.trim());
};
