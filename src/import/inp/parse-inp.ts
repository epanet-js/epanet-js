import { ModelMetadata } from "src/model-metadata";
import { IssuesAccumulator, ParserIssues } from "./issues";
import { readInpData } from "./read-inp-data";
import { buildModel } from "./build-model";
import { HydraulicModel } from "src/hydraulic-model";

export const parseInp = (
  inp: string,
): {
  hydraulicModel: HydraulicModel;
  modelMetadata: ModelMetadata;
  issues: ParserIssues | null;
} => {
  const issues = new IssuesAccumulator();
  const inpData = readInpData(inp, issues);
  const { hydraulicModel, modelMetadata } = buildModel(inpData, issues);
  return {
    hydraulicModel,
    modelMetadata,
    issues: issues.buildResult(),
  };
};
