import { HeadlossFormula } from "src/hydraulic-model/asset-types/pipe";
import {
  EpanetUnitSystem,
  defaultAccuracy,
  defaultUnbalanced,
} from "src/simulation/build-inp";
import { InpData } from "./inp-data";
import { IssuesAccumulator } from "./issues";

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

export const readInpData = (
  inp: string,
  issues: IssuesAccumulator,
): InpData => {
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

const detectNewSectionName = (trimmedRow: string): string | null => {
  if (!trimmedRow.startsWith("[")) return null;
  const sectionName = epanetSections.find((name) => trimmedRow.includes(name));
  return sectionName || null;
};

const readValues = (row: string): string[] => {
  const rowWithoutComments = row.split(";")[0];
  return rowWithoutComments.split("\t").map((s) => s.trim());
};
