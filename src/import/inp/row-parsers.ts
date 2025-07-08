import {
  EpanetUnitSystem,
  defaultAccuracy,
  defaultUnbalanced,
} from "src/simulation/build-inp";
import { InpData, TankData } from "./inp-data";
import { IssuesAccumulator } from "./issues";
import { HeadlossFormula } from "src/hydraulic-model";
import { ValveKind } from "src/hydraulic-model/asset-types/valve";

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
  const [id, baseHead, patternId] = readValues(trimmedRow);

  inpData.reservoirs.push({ id, baseHead: parseFloat(baseHead), patternId });
  inpData.nodeIds.add(id);
};

export const parseJunction: RowParser = ({ trimmedRow, inpData }) => {
  const [id, elevation, baseDemand, patternId] = readValues(trimmedRow);

  const junctionData = {
    id,
    elevation: parseFloat(elevation),
    baseDemand: baseDemand ? parseFloat(baseDemand) : undefined,
    patternId: patternId ? patternId : undefined,
  };
  inpData.junctions.push(junctionData);

  inpData.nodeIds.add(id);
};

export const parseValve: RowParser = ({ trimmedRow, inpData, issues }) => {
  const [
    id,
    startNodeDirtyId,
    endNodeDirtyId,
    diameter,
    type,
    setting,
    minorLoss,
  ] = readValues(trimmedRow);

  let kind = type.toLowerCase();
  if (kind === "gpv") {
    issues.addGPVUsed();
    kind = "tcv";
  }

  inpData.valves.push({
    id,
    startNodeDirtyId,
    endNodeDirtyId,
    diameter: parseFloat(diameter),
    kind: kind as ValveKind,
    setting: parseFloat(setting),
    minorLoss: parseFloat(minorLoss),
  });
};

export const parsePump: RowParser = ({ trimmedRow, inpData }) => {
  const [id, startNodeDirtyId, endNodeDirtyId, ...settingFields] =
    readValues(trimmedRow);

  let power = undefined;
  let curveId = undefined;
  let speed = undefined;
  let patternId = undefined;

  for (let i = 0; i < settingFields.length; i += 2) {
    const key = settingFields[i].toUpperCase();
    const value = settingFields[i + 1];
    if (key === "POWER") {
      power = parseFloat(value);
    }

    if (key === "HEAD") {
      curveId = value;
    }

    if (key === "SPEED") {
      speed = parseFloat(value);
    }

    if (key === "PATTERN") {
      patternId = value;
    }
  }

  inpData.pumps.push({
    id,
    startNodeDirtyId,
    endNodeDirtyId,
    power,
    curveId,
    speed,
    patternId,
  });
};

export const parseCurve: RowParser = ({ trimmedRow, inpData }) => {
  const [curveId, x, y] = readValues(trimmedRow);
  const curvePoints = inpData.curves.get(curveId) || [];

  curvePoints.push({ x: parseFloat(x), y: parseFloat(y) });
  inpData.curves.set(curveId, curvePoints);
};

export const parseStatus: RowParser = ({ trimmedRow, inpData }) => {
  const [linkId, value] = readValues(trimmedRow);
  inpData.status.set(linkId, value.toUpperCase());
};

export const parseTankPartially: RowParser = ({
  sectionName,
  trimmedRow,
  inpData,
  issues,
}) => {
  issues.addUsedSection(sectionName);
  const [id, elevation, initialLevel] = readValues(trimmedRow);
  inpData.tanks.push({
    id,
    elevation: parseFloat(elevation),
    initialLevel: parseFloat(initialLevel),
    minLevel: 0,
    maxLevel: 100,
    diameter: 50,
    minVolume: 0,
  });

  inpData.nodeIds.add(id);
};

export const parseTank: RowParser = ({ trimmedRow, inpData, issues }) => {
  const [
    id,
    elevation,
    initialLevel,
    minLevel,
    maxLevel,
    diameter,
    minVolume,
    volumeCurveId,
    overflow,
  ] = readValues(trimmedRow);

  const tankData: TankData = {
    id,
    elevation: parseFloat(elevation),
    initialLevel: parseFloat(initialLevel),
    minLevel: parseFloat(minLevel),
    maxLevel: parseFloat(maxLevel),
    diameter: parseFloat(diameter),
    minVolume: parseFloat(minVolume),
  };

  if (volumeCurveId && volumeCurveId !== "*") {
    tankData.volumeCurveId = volumeCurveId;
    issues.addUsedSection("[CURVES]");
  }

  if (overflow) {
    tankData.overflow = overflow.toUpperCase() === "YES";
  }

  inpData.tanks.push(tankData);
  inpData.nodeIds.add(id);
};

export const parsePipe: RowParser = ({ trimmedRow, inpData }) => {
  const [
    id,
    startNodeDirtyId,
    endNodeDirtyId,
    length,
    diameter,
    roughness,
    minorLoss,
    status,
  ] = readValues(trimmedRow);

  inpData.pipes.push({
    id,
    startNodeDirtyId,
    endNodeDirtyId,
    length: parseFloat(length),
    diameter: parseFloat(diameter),
    roughness: parseFloat(roughness),
    minorLoss: parseFloat(minorLoss),
    status: status && status.toLowerCase() === "closed" ? "closed" : "open",
  });
};

export const parseDemand: RowParser = ({ trimmedRow, inpData }) => {
  const [nodeId, baseDemand, patternId] = readValues(trimmedRow);
  const demands = inpData.demands.get(nodeId) || [];
  demands.push({
    baseDemand: parseFloat(baseDemand),
    patternId,
  });
  inpData.demands.set(nodeId, demands);
};

export const parsePosition: RowParser = ({ trimmedRow, inpData }) => {
  const [nodeId, lng, lat] = readValues(trimmedRow);
  inpData.coordinates.set(nodeId, [parseFloat(lng), parseFloat(lat)]);
};

export const parsePattern: RowParser = ({ trimmedRow, inpData }) => {
  const [patternId, ...values] = readValues(trimmedRow);
  const factors = inpData.patterns.get(patternId) || [];
  factors.push(...values.map((v) => parseFloat(v)));
  inpData.patterns.set(patternId, factors);
};

export const parseVertex: RowParser = ({ trimmedRow, inpData }) => {
  const [linkId, lng, lat] = readValues(trimmedRow);
  const vertices = inpData.vertices.get(linkId) || [];
  vertices.push([parseFloat(lng), parseFloat(lat)]);
  inpData.vertices.set(linkId, vertices);
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
      issues.addUsedTimeSetting("DURATION", setting.defaultValue);
    }
  }
  if (setting.name === "PATTERN START") {
    const [value] = readValues(setting.value as string);
    if (parseInt(value) !== 0) {
      issues.addUsedTimeSetting(setting.name, setting.defaultValue);
    }
  }
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

  if (name === "DEMAND MULTIPLIER") {
    inpData.options.demandMultiplier = value as number;
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
