import {
  EpanetUnitSystem,
  defaultAccuracy,
  defaultUnbalanced,
} from "src/simulation/build-inp";
import { InpData } from "./inp-data";
import { IssuesAccumulator } from "./issues";
import { HeadlossFormula } from "src/hydraulic-model";
import { isFeatureOn } from "src/infra/feature-flags";

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
  if (isFeatureOn("FLAG_JUNCTION_DEMANDS")) {
    const [id, elevation, baseDemand, patternId] = readValues(trimmedRow);

    inpData.junctions.push({
      id,
      elevation: parseFloat(elevation),
      baseDemand: baseDemand ? parseFloat(baseDemand) : undefined,
      patternId: patternId ? patternId : undefined,
    });
  } else {
    const [id, elevation] = readValues(trimmedRow);

    inpData.junctions.push({
      id,
      elevation: parseFloat(elevation),
    });
  }
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
  const [nodeId, baseDemand, patternId] = readValues(trimmedRow);
  if (!inpData.demands[nodeId]) {
    inpData.demands[nodeId] = [];
  }

  inpData.demands[nodeId].push({
    baseDemand: parseFloat(baseDemand),
    patternId: patternId ? patternId : undefined,
  });
};

export const parsePosition: RowParser = ({ trimmedRow, inpData }) => {
  const [nodeId, lng, lat] = readValues(trimmedRow);
  inpData.coordinates[nodeId] = [parseFloat(lng), parseFloat(lat)];
};

export const parsePattern: RowParser = ({ trimmedRow, inpData }) => {
  const [patternId, ...values] = readValues(trimmedRow);
  if (!inpData.patterns[patternId]) {
    inpData.patterns[patternId] = [];
  }
  inpData.patterns[patternId].push(...values.map((v) => parseFloat(v)));
};

export const parseVertex: RowParser = ({ trimmedRow, inpData }) => {
  const [linkId, lng, lat] = readValues(trimmedRow);
  if (!inpData.vertices[linkId]) inpData.vertices[linkId] = [];

  inpData.vertices[linkId].push([parseFloat(lng), parseFloat(lat)]);
};

export const parseTimeSetting: RowParser = ({ trimmedRow, issues }) => {
  const setting = readSetting(trimmedRow, {
    DURATION: "0 SEC",
    "PATTERN START": "0 SEC",
  });
  if (!setting) return;

  if (setting.name === "DURATION") {
    const [value] = readValues(setting.value as string);
    if (parseInt(value) !== 0) {
      issues.addEPS();
      isFeatureOn("FLAG_JUNCTION_DEMANDS") &&
        issues.addUsedTimeSetting("DURATION", setting.defaultValue);
    }
  }
  if (setting.name === "PATTERN START") {
    const [value] = readValues(setting.value as string);
    if (parseInt(value) !== 0) {
      isFeatureOn("FLAG_JUNCTION_DEMANDS") &&
        issues.addUsedTimeSetting(setting.name, setting.defaultValue);
    }
  }
};

export const parseTankPartially: RowParser = ({
  sectionName,
  trimmedRow,
  inpData,
  issues,
}) => {
  issues.addUsedSection(sectionName);
  const [tankId, elevation, initialLevel] = readValues(trimmedRow);
  inpData.tanks.push({
    id: tankId,
    elevation: parseFloat(elevation),
    initialLevel: parseFloat(initialLevel),
  });
};

export const parseOption: RowParser = ({
  trimmedRow,
  inpData,
  issues,
}): void => {
  const option = readSetting(trimmedRow, defaultOptions);
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

const readSetting = <T extends Record<string, string | number>>(
  trimmedRow: string,
  settings: T,
):
  | { name: string; value: number; defaultValue: number }
  | { name: string; value: string; defaultValue: string }
  | null => {
  const rowWithoutComments = trimmedRow.split(commentIdentifier)[0];
  const upperCaseRow = rowWithoutComments.toUpperCase();
  const name = Object.keys(settings).find((name) =>
    upperCaseRow.startsWith(name),
  );

  if (!name) return null;
  const value = upperCaseRow.replace(new RegExp(`^${name}\\s*`), "").trim();

  const defaultValue = settings[name];
  if (typeof defaultValue === "number") {
    return { name, value: parseFloat(value), defaultValue };
  } else {
    return { name, value, defaultValue };
  }
};
