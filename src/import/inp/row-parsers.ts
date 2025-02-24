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
    status: status && status.toLowerCase() === "closed" ? "closed" : "open",
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
  const [name, value] = readSetting(trimmedRow);
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
  const option = readOption(trimmedRow, defaultOptions);
  if (!option) return;

  const { name, value, defaultValue } = option;

  if (name === "UNITS") {
    inpData.options.units = value as EpanetUnitSystem;
    return;
  }
  if (name === "HEADLOSS") {
    inpData.options.headlossFormula = value as HeadlossFormula;
    return;
  }

  if (name === "UNBALANCED") {
    if (value !== defaultValue) {
      issues.hasUnbalancedDiff(value as string, defaultValue as string);
    }
    return;
  }

  if (defaultValue !== value) {
    issues.addUsedOption(name, defaultValue);
  }
};

const readValues = (row: string): string[] => {
  const rowWithoutComments = row.split(commentIdentifier)[0];
  return rowWithoutComments.split(/\s+/).map((s) => s.trim());
};

const readSetting = (row: string): string[] => {
  const rowWithoutComments = row.split(commentIdentifier)[0];
  return rowWithoutComments.split("\t").map((s) => s.trim());
};
const readOption = (
  trimmedRow: string,
  options: typeof defaultOptions,
):
  | { name: string; value: number; defaultValue: number }
  | { name: string; value: string; defaultValue: string }
  | null => {
  const rowWithoutComments = trimmedRow.split(commentIdentifier)[0];
  const upperCaseRow = rowWithoutComments.toUpperCase();
  const option = Object.keys(options).find((option) =>
    upperCaseRow.startsWith(option),
  ) as keyof typeof defaultOptions | undefined;

  if (!option) return null;
  const value = upperCaseRow.replace(new RegExp(`^${option}\\s*`), "").trim();

  const defaultValue = options[option];
  if (typeof defaultValue === "number") {
    return { name: option, value: parseFloat(value), defaultValue };
  } else {
    return { name: option, value, defaultValue };
  }
};
