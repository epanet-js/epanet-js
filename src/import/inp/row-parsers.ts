import {
  EpanetUnitSystem,
  defaultAccuracy,
  defaultUnbalanced,
  defaultCustomersPatternId,
} from "src/simulation/build-inp";
import { InpData, TankData } from "./inp-data";
import { IssuesAccumulator } from "./issues";
import { HeadlossFormula } from "src/hydraulic-model";
import { ValveKind } from "src/hydraulic-model/asset-types/valve";
import { PipeStatus } from "src/hydraulic-model/asset-types/pipe";
import { ParseInpOptions } from "./parse-inp";

export type RowParser = (params: {
  sectionName: string;
  trimmedRow: string;
  isCommented: boolean;
  inpData: InpData;
  issues: IssuesAccumulator;
  options?: ParseInpOptions;
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
  PATTERN: "1",
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

const defaultEnergySettings: Record<string, number> = {
  "GLOBAL EFFICIENCY": 75,
  "GLOBAL PRICE": 0,
  "DEMAND CHARGE": 0,
};

export const parseEnergy: RowParser = ({ sectionName, trimmedRow, issues }) => {
  const setting = readSetting(trimmedRow, defaultEnergySettings);
  if (setting && setting.value !== setting.defaultValue) {
    issues.addUsedSection(sectionName);
  } else if (!setting) {
    // Unsupported Energy settings
    issues.addUsedSection(sectionName);
  }
};

export const parseEmitter: RowParser = ({
  sectionName,
  trimmedRow,
  issues,
}) => {
  const [, coefficient] = readValues(trimmedRow);
  const value = parseFloat(coefficient);
  if (!isNaN(value) && value !== 0) {
    issues.addUsedSection(sectionName);
  }
};

const defaultReactionSettings: Record<string, number> = {
  "ORDER BULK": 1,
  "ORDER TANK": 1,
  "ORDER WALL": 1,
  "GLOBAL BULK": 0,
  "GLOBAL WALL": 0,
  "LIMITING POTENTIAL": 0,
  "ROUGHNESS CORRELATION": 0,
};

export const parseReaction: RowParser = ({
  sectionName,
  trimmedRow,
  issues,
}) => {
  const setting = readSetting(trimmedRow, defaultReactionSettings);
  if (setting && setting.value !== setting.defaultValue) {
    issues.addUsedSection(sectionName);
  } else if (!setting) {
    // Unsupported Reaction settings
    issues.addUsedSection(sectionName);
  }
};

export const parseReservoir: RowParser = ({
  trimmedRow,
  inpData,
  issues,
  isCommented,
}) => {
  const [id, baseHead, patternId] = readValues(trimmedRow);

  if (patternId) {
    issues.addReservoirPattern();
  }

  inpData.reservoirs.push({
    id,
    baseHead: parseFloat(baseHead),
    patternId,
    isActive: !isCommented,
  });
  inpData.nodeIds.add(id);
};

export const parseJunction: RowParser = ({
  trimmedRow,
  inpData,
  isCommented,
}) => {
  const [id, elevation, baseDemand, patternId] = readValues(trimmedRow);

  const junctionData = {
    id,
    elevation: parseFloat(elevation),
    baseDemand: baseDemand ? parseFloat(baseDemand) : undefined,
    patternId: patternId ? patternId : undefined,
    isActive: !isCommented,
  };
  inpData.junctions.push(junctionData);

  inpData.nodeIds.add(id);
};

export const parseValve: RowParser = ({
  trimmedRow,
  inpData,
  issues,
  isCommented,
}) => {
  const [
    id,
    startNodeDirtyId,
    endNodeDirtyId,
    diameter,
    type,
    setting,
    minorLoss,
    curveId,
  ] = readValues(trimmedRow);

  let kind = type.toLowerCase();
  if (kind === "gpv") {
    issues.addGPVUsed();
    kind = "tcv";
  }

  if (kind === "pcv" && curveId) {
    issues.addPCVCurve();
  }

  inpData.valves.push({
    id,
    startNodeDirtyId,
    endNodeDirtyId,
    diameter: parseFloat(diameter),
    kind: kind as ValveKind,
    setting: parseFloat(setting),
    minorLoss: parseFloat(minorLoss),
    isActive: !isCommented,
  });
};

export const parsePump: RowParser = ({
  trimmedRow,
  inpData,
  issues,
  isCommented,
}) => {
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
      issues.addPumpPattern();
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
    isActive: !isCommented,
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
  isCommented,
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
    isActive: !isCommented,
  });

  inpData.nodeIds.add(id);
};

export const parseTank: RowParser = ({
  trimmedRow,
  inpData,
  issues,
  isCommented,
}) => {
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
    isActive: !isCommented,
  };

  if (volumeCurveId && volumeCurveId !== "*") {
    tankData.volumeCurveId = volumeCurveId;
    issues.addTankCurve();
  }

  if (overflow) {
    tankData.overflow = overflow.toUpperCase() === "YES";
  }

  inpData.tanks.push(tankData);
  inpData.nodeIds.add(id);
};

export const parsePipe: RowParser = ({ trimmedRow, inpData, isCommented }) => {
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

  let initialStatus: PipeStatus = "open";
  if (status) {
    const statusLower = status.toLowerCase();
    if (statusLower === "closed") {
      initialStatus = "closed";
    } else if (statusLower === "cv") {
      initialStatus = "cv";
    }
  }

  inpData.pipes.push({
    id,
    startNodeDirtyId,
    endNodeDirtyId,
    length: parseFloat(length),
    diameter: parseFloat(diameter),
    roughness: parseFloat(roughness),
    minorLoss: minorLoss !== undefined ? parseFloat(minorLoss) : 0,
    initialStatus,
    isActive: !isCommented,
  });
};

export const parseDemand: RowParser = ({ trimmedRow, inpData }) => {
  const [nodeId, baseDemand, patternId] = readValues(trimmedRow);
  const comment = readComment(trimmedRow);

  if (
    patternId === defaultCustomersPatternId ||
    comment.includes(defaultCustomersPatternId)
  ) {
    return;
  }

  const demands = inpData.demands.get(nodeId) || [];
  demands.push({
    baseDemand: parseFloat(baseDemand),
    patternLabel: patternId,
  });
  inpData.demands.set(nodeId, demands);
};

export const parsePosition: RowParser = ({ trimmedRow, inpData }) => {
  const [nodeId, lng, lat] = readValues(trimmedRow);
  inpData.coordinates.set(nodeId, [parseFloat(lng), parseFloat(lat)]);
};

export const parsePattern: RowParser = ({ trimmedRow, inpData }) => {
  const [patternId, ...values] = readValues(trimmedRow);
  const normalizedLabel = patternId.toUpperCase();
  const existing = inpData.patterns.get(normalizedLabel);
  const multipliers = existing?.multipliers || [];
  multipliers.push(...values.map((v) => parseFloat(v)));
  inpData.patterns.set(normalizedLabel, { label: patternId, multipliers });
};

export const parseVertex: RowParser = ({ trimmedRow, inpData }) => {
  const [linkId, lng, lat] = readValues(trimmedRow);
  const vertices = inpData.vertices.get(linkId) || [];
  vertices.push([parseFloat(lng), parseFloat(lat)]);
  inpData.vertices.set(linkId, vertices);
};

const defaultTimeSettings = {
  DURATION: "0",
  "HYDRAULIC TIMESTEP": "0",
  "REPORT TIMESTEP": "0",
  "PATTERN TIMESTEP": "0",
  "PATTERN START": "0",
  "REPORT START": "0",
  "START CLOCKTIME": "0",
  STATISTIC: "NONE",
};

const timeSettingsCoveredByOtherWarnings = [
  "QUALITY TIMESTEP",
  "RULE TIMESTEP",
];

const parseTimeToSeconds = (timeStr: string): number => {
  const trimmed = timeStr.trim().toUpperCase();

  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");
    if (parts.length === 2) {
      const hours = parseInt(parts[0], 10) || 0;
      const minutes = parseInt(parts[1], 10) || 0;
      return hours * 3600 + minutes * 60;
    }
    if (parts.length === 3) {
      const hours = parseInt(parts[0], 10) || 0;
      const minutes = parseInt(parts[1], 10) || 0;
      const seconds = parseInt(parts[2], 10) || 0;
      return hours * 3600 + minutes * 60 + seconds;
    }
  }

  const numericMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (numericMatch) {
    const value = parseFloat(numericMatch[1]);
    const unit = numericMatch[2];

    if (unit.startsWith("SEC") || unit === "S") return value;
    if (unit.startsWith("MIN") || unit === "M") return value * 60;
    if (unit.startsWith("HOUR") || unit === "H" || unit === "HR")
      return value * 3600;
    if (unit.startsWith("DAY") || unit === "D") return value * 86400;

    return value * 3600;
  }

  return 0;
};

const parseClocktimeToSeconds = (timeStr: string): number => {
  const trimmed = timeStr.trim().toUpperCase();

  const isPM = trimmed.includes("PM");
  const isAM = trimmed.includes("AM");
  const timeOnly = trimmed.replace(/\s*(AM|PM)\s*$/i, "").trim();

  let hours = 0;
  let minutes = 0;

  if (timeOnly.includes(":")) {
    const parts = timeOnly.split(":");
    hours = parseInt(parts[0], 10) || 0;
    minutes = parseInt(parts[1], 10) || 0;
  } else {
    hours = parseInt(timeOnly, 10) || 0;
  }

  if (isAM || isPM) {
    if (hours === 12) {
      hours = isPM ? 12 : 0;
    } else if (isPM) {
      hours += 12;
    }
  }

  return hours * 3600 + minutes * 60;
};

export const parseTimeSetting: RowParser = ({
  trimmedRow,
  inpData,
  issues,
}) => {
  const upperRow = trimmedRow.toUpperCase();

  for (const covered of timeSettingsCoveredByOtherWarnings) {
    if (upperRow.startsWith(covered)) {
      return;
    }
  }

  const setting = readSetting(trimmedRow, defaultTimeSettings);
  if (!setting) return;

  const { name, value, defaultValue } = setting as {
    name: string;
    value: string;
    defaultValue: string;
  };

  if (name === "DURATION") {
    inpData.times.duration = parseTimeToSeconds(value);
  }
  if (name === "HYDRAULIC TIMESTEP") {
    inpData.times.hydraulicTimestep = parseTimeToSeconds(value);
  }
  if (name === "REPORT TIMESTEP") {
    inpData.times.reportTimestep = parseTimeToSeconds(value);
  }
  if (name === "PATTERN TIMESTEP") {
    inpData.times.patternTimestep = parseTimeToSeconds(value);
  }
  if (name === "PATTERN START") {
    inpData.times.patternStart = parseTimeToSeconds(value);
  }
  if (name === "REPORT START") {
    inpData.times.reportStart = parseTimeToSeconds(value);
  }
  if (name === "START CLOCKTIME") {
    inpData.times.startClocktime = parseClocktimeToSeconds(value);
  }
  if (name === "STATISTIC") {
    inpData.times.statistic = value;
  }

  if (name === "PATTERN START" && inpData.times.patternStart !== 0) {
    issues.addUsedTimeSetting(name, defaultValue);
  }
  if (name === "REPORT START" && inpData.times.reportStart !== 0) {
    issues.addUsedTimeSetting(name, defaultValue);
  }
  if (name === "START CLOCKTIME" && inpData.times.startClocktime !== 0) {
    issues.addUsedTimeSetting(name, defaultValue);
  }
  if (name === "STATISTIC" && inpData.times.statistic !== defaultValue) {
    issues.addUsedTimeSetting(name, defaultValue);
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

  if (name === "PATTERN") {
    inpData.options.defaultPattern = value as string;
    return;
  }

  if (name === "QUALITY") {
    const upperValue =
      typeof value === "string" ? value.toUpperCase() : String(value);
    if (upperValue.startsWith("NONE")) return;

    if (upperValue.startsWith("AGE")) {
      issues.addWaterQualityType("AGE");
    } else if (upperValue.startsWith("TRACE")) {
      issues.addWaterQualityType("TRACE");
    } else {
      issues.addWaterQualityType("CHEMICAL");
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

const readComment = (row: string): string => {
  const comment = row.split(commentIdentifier)?.[1];
  return comment ? comment.trim() : "";
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

export const parseControl: RowParser = ({ trimmedRow, inpData }) => {
  if (inpData.controls.simple) {
    inpData.controls.simple += "\n" + trimmedRow;
  } else {
    inpData.controls.simple = trimmedRow;
  }
};

export const parseRule: RowParser = ({ trimmedRow, inpData }) => {
  if (inpData.controls.ruleBased) {
    inpData.controls.ruleBased += "\n" + trimmedRow;
  } else {
    inpData.controls.ruleBased = trimmedRow;
  }
};
