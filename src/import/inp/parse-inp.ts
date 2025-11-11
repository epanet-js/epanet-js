import { ModelMetadata } from "src/model-metadata";
import { IssuesAccumulator, ParserIssues } from "./issues";
import { readInpData } from "./read-inp-data";
import { buildModel } from "./build-model";
import { HydraulicModel } from "src/hydraulic-model";
import { checksum } from "src/infra/checksum";
import { InpStats } from "./inp-data";

export type ParseInpOptions = {
  customerPoints?: boolean;
  inactiveAssets?: boolean;
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
  const isMadeByApp = validateChecksum(inp);

  const safeOptions: ParseInpOptions = {
    ...options,
    customerPoints: isMadeByApp ? options?.customerPoints : false,
  };

  const { inpData, stats } = readInpData(inp, issues, safeOptions);
  const { hydraulicModel, modelMetadata } = buildModel(
    inpData,
    issues,
    safeOptions,
  );
  return {
    isMadeByApp,
    hydraulicModel,
    modelMetadata,
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
