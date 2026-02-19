import { ModelMetadata } from "src/model-metadata";
import { IssuesAccumulator, ParserIssues } from "./issues";
import { readInpData } from "./read-inp-data";
import { buildModel } from "./build-model";
import { HydraulicModel } from "src/hydraulic-model";
import { checksum } from "src/infra/checksum";
import { InpData, InpStats } from "./inp-data";
import { Position } from "geojson";
import {
  Projection,
  ProjectionMapper,
  buildProjectionMapper,
} from "src/projections";

export type ParseInpOptions = {
  customerPoints?: boolean;
  inactiveAssets?: boolean;
  usedPatterns?: boolean;
  sourceProjection?: Projection;
};

export const parseInp = (
  inp: string,
  options?: ParseInpOptions,
): {
  isMadeByApp: boolean;
  hydraulicModel: HydraulicModel;
  modelMetadata: ModelMetadata;
  issues: ParserIssues | null;
  stats: InpStats;
} => {
  const issues = new IssuesAccumulator();
  const header = parseHeader(inp);

  const safeOptions: ParseInpOptions = {
    ...options,
    customerPoints: header.isMadeByApp ? options?.customerPoints : false,
    inactiveAssets: header.isMadeByApp ? options?.inactiveAssets : false,
  };

  const { inpData, stats } = readInpData(inp, issues, safeOptions);

  const sourceProjection: Projection =
    header.sourceProjection ?? options?.sourceProjection ?? "wgs84";

  const projectionMapper = projectCoordinates(inpData, sourceProjection);

  const { hydraulicModel, modelMetadata } = buildModel(
    inpData,
    issues,
    safeOptions,
  );
  return {
    isMadeByApp: header.isMadeByApp,
    hydraulicModel,
    modelMetadata: {
      ...modelMetadata,
      projectionMapper,
    },
    issues: issues.buildResult(),
    stats,
  };
};

const projectCoordinates = (
  inpData: InpData,
  sourceProjection: Projection,
): ProjectionMapper => {
  if (sourceProjection === "wgs84") {
    return buildProjectionMapper("wgs84", () => []);
  }

  const getAllPoints = () => {
    const points: Position[] = [];
    for (const [, p] of inpData.coordinates.entries()) points.push(p);
    for (const [, verts] of inpData.vertices.entries()) points.push(...verts);
    return points;
  };

  const projectionMapper = buildProjectionMapper(
    sourceProjection,
    getAllPoints,
  );

  for (const [id, p] of inpData.coordinates.entries()) {
    inpData.coordinates.set(id, projectionMapper.toWgs84(p));
  }
  for (const [id, verts] of inpData.vertices.entries()) {
    inpData.vertices.set(id, verts.map(projectionMapper.toWgs84));
  }

  return projectionMapper;
};

type Header = { isMadeByApp: boolean; sourceProjection?: Projection };

const checksumRegexp = /\[([0-9A-Fa-f]{8})\]/;
const projectionRegexp = /^;PROJECTION\s+(\S+)/;

const parseHeader = (inp: string): Header => {
  const newLineIndex = inp.indexOf("\n");
  if (newLineIndex === -1) return { isMadeByApp: false };

  const checksumRow = inp.substring(0, newLineIndex);
  if (!checksumRow.includes(";MADE BY EPANET-JS"))
    return { isMadeByApp: false };

  const match = checksumRow.match(checksumRegexp);
  if (!match) return { isMadeByApp: false };

  const inputChecksum = match[1];
  const rest = inp.substring(newLineIndex + 1);
  const computedChecksum = checksum(rest);
  if (inputChecksum !== computedChecksum) return { isMadeByApp: false };

  const secondLineEnd = rest.indexOf("\n");
  if (secondLineEnd === -1) return { isMadeByApp: true };

  const secondLine = rest.substring(0, secondLineEnd);
  const projectionMatch = secondLine.match(projectionRegexp);
  const sourceProjection = projectionMatch
    ? (projectionMatch[1] as Projection)
    : undefined;

  return { isMadeByApp: true, sourceProjection };
};
