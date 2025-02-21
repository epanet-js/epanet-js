import {
  EpanetUnitSystem,
  defaultAccuracy,
  defaultUnbalanced,
} from "src/simulation/build-inp";
import { InpData } from "./inp-data";
import { IssuesAccumulator } from "./issues";
import { HeadlossFormula } from "src/hydraulic-model";

export type RowParser = (params: {
  sectionName: string;
  trimmedRow: string;
  inpData: InpData;
  issues: IssuesAccumulator;
}) => void;

export const commentIdentifier = ";";

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
  CHECKFREQ: 2,
  MAXCHECK: 10,
  DAMPLIMIT: 0,
};

const defaultOptions = {
  ...epanetDefaultOptions,
  UNITS: "LPS",
  ACCURACY: defaultAccuracy,
  UNBALANCED: defaultUnbalanced,
};

export const ignore: RowParser = () => {};
export const unsupported: RowParser = ({ sectionName, issues }) => {
  issues.addUsedSection(sectionName);
};
export const parseReservoir: RowParser = ({ trimmedRow, inpData }) => {
  const [id, head] = readValues(trimmedRow);

  inpData.reservoirs.push({ id, head: parseFloat(head) });
};

export const parseJunction: RowParser = ({ trimmedRow, inpData }) => {
  const [id, elevation] = readValues(trimmedRow);

  inpData.junctions.push({ id, elevation: parseFloat(elevation) });
};

export const parsePipe: RowParser = ({ trimmedRow, inpData }) => {
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
};

export const parseDemand: RowParser = ({ trimmedRow, inpData }) => {
  const [nodeId, demand] = readValues(trimmedRow);
  inpData.demands[nodeId] = parseFloat(demand);
};

export const parsePosition: RowParser = ({ trimmedRow, inpData }) => {
  const [nodeId, lng, lat] = readValues(trimmedRow);
  inpData.coordinates[nodeId] = [parseFloat(lng), parseFloat(lat)];
};

export const parseVertex: RowParser = ({ trimmedRow, inpData }) => {
  const [linkId, lng, lat] = readValues(trimmedRow);
  if (!inpData.vertices[linkId]) inpData.vertices[linkId] = [];

  inpData.vertices[linkId].push([parseFloat(lng), parseFloat(lat)]);
};

export const parseTimeSetting: RowParser = ({ trimmedRow, issues }) => {
  const [name, value] = readValues(trimmedRow);
  const normalizedName = name.toUpperCase();
  if (normalizedName === "DURATION" && parseInt(value) !== 0) {
    issues.addEPS();
  }
};

export const parseOption: RowParser = ({
  trimmedRow,
  inpData,
  issues,
}): void => {
  const [name, value] = readValues(trimmedRow);
  if (!value) return;

  const normalizedName = name.toUpperCase() as keyof typeof defaultOptions;
  if (normalizedName === "UNITS") {
    inpData.options.units = value as EpanetUnitSystem;
    return;
  }
  if (normalizedName === "HEADLOSS") {
    inpData.options.headlossFormula = value as HeadlossFormula;
    return;
  }

  if (normalizedName === "UNBALANCED") {
    const normalizedValue = value.toUpperCase();
    if (normalizedValue !== defaultUnbalanced) {
      issues.hasUnbalancedDiff(normalizedValue, defaultUnbalanced);
    }
    return;
  }

  const defaultValue = defaultOptions[normalizedName];
  if (typeof defaultValue === "number") {
    if (parseFloat(value) !== defaultValue)
      issues.addUsedOption(normalizedName, defaultValue);
  } else {
    if (defaultValue !== value.toUpperCase())
      issues.addUsedOption(normalizedName, defaultValue);
  }
};

const readValues = (row: string): string[] => {
  const rowWithoutComments = row.split(commentIdentifier)[0];
  return rowWithoutComments.split("\t").map((s) => s.trim());
};
