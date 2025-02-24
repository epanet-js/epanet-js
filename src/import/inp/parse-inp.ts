import { ModelMetadata } from "src/model-metadata";
import { IssuesAccumulator, ParserIssues } from "./issues";
import { readInpData } from "./read-inp-data";
import { buildModel } from "./build-model";
import { HydraulicModel } from "src/hydraulic-model";
import crc32 from "crc/crc32";
import { isFeatureOn } from "src/infra/feature-flags";

export const parseInp = (
  inp: string,
): {
  isMadeByApp: boolean;
  hydraulicModel: HydraulicModel;
  modelMetadata: ModelMetadata;
  issues: ParserIssues | null;
} => {
  const issues = new IssuesAccumulator();
  const isMadeByApp = validateChecksum(inp);
  const inpData = readInpData(inp, issues);
  const { hydraulicModel, modelMetadata } = buildModel(inpData, issues);
  return {
    isMadeByApp,
    hydraulicModel,
    modelMetadata,
    issues: issues.buildResult(),
  };
};

const checksumRegexp = /\[([0-9A-Fa-f]{8})\]/;
const validateChecksum = (inp: string): boolean => {
  if (!isFeatureOn("FLAG_MADE_BY")) return false;

  if (!inp.trim().startsWith(";MADE BY EPANET-JS")) return false;

  const [checksumRow, ...rows] = inp.split("\n");

  const match = checksumRow.match(checksumRegexp);
  if (!match) return false;

  const inputChecksum = match[1];

  const computedChecksum = checksum(rows.join("\n"));
  return inputChecksum === computedChecksum;
};

const checksum = (content: string): string => {
  return crc32(content).toString(16);
};
