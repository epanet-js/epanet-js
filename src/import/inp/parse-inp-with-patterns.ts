import { ModelMetadata } from "src/model-metadata";
import { IssuesAccumulator, ParserIssues } from "./issues";
import { readInpData } from "./read-inp-data";
import { buildModelWithPatterns } from "./build-model-with-patterns";
import { HydraulicModel } from "src/hydraulic-model";
import { checksum } from "src/infra/checksum";
import { InpStats } from "./inp-data";
import { transformNonProjectedCoordinates } from "./non-projected-transform";
import { Projection, createProjectionMapper } from "src/projections";

export type ParseInpOptions = {
  customerPoints?: boolean;
  inactiveAssets?: boolean;
  usedPatterns?: boolean;
  sourceProjection?: Projection;
};

export const parseInpWithPatterns = (
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
  const isMadeByApp = validateChecksum(inp);

  const safeOptions: ParseInpOptions = {
    ...options,
    customerPoints: isMadeByApp ? options?.customerPoints : false,
    inactiveAssets: isMadeByApp ? options?.inactiveAssets : false,
  };

  const { inpData, stats } = readInpData(inp, issues, safeOptions);

  const sourceProjection: Projection =
    options?.sourceProjection !== undefined
      ? options.sourceProjection
      : "wgs84";

  const projectionCentroid =
    sourceProjection === "xy-grid"
      ? (transformNonProjectedCoordinates(inpData) ?? undefined)
      : undefined;

  const projectionMapper =
    sourceProjection === "xy-grid" && projectionCentroid
      ? createProjectionMapper({
          type: "xy-grid",
          centroid: projectionCentroid,
        })
      : createProjectionMapper({ type: "wgs84" });

  const { hydraulicModel, modelMetadata } = buildModelWithPatterns(
    inpData,
    issues,
    safeOptions,
  );
  return {
    isMadeByApp,
    hydraulicModel,
    modelMetadata: {
      ...modelMetadata,
      projectionMapper,
    },
    issues: issues.buildResult(),
    stats,
  };
};

const checksumRegexp = /\[([0-9A-Fa-f]{8})\]/;
const validateChecksum = (inp: string): boolean => {
  const newLineIndex = inp.indexOf("\n");
  if (newLineIndex === -1) return false;

  const checksumRow = inp.substring(0, newLineIndex);
  if (!checksumRow.includes(";MADE BY EPANET-JS")) return false;

  const match = checksumRow.match(checksumRegexp);
  if (!match) return false;

  const inputChecksum = match[1];

  const computedChecksum = checksum(inp.substring(newLineIndex + 1));
  return inputChecksum === computedChecksum;
};
