import type { GisInput, ScanSourceResult } from "./importer";
import { parseGisSource } from "./file-parsers/parse-gis-source";
import { summarizeFeatures } from "./file-parsers/summarize";

export const scanSource = async (
  input: GisInput,
): Promise<ScanSourceResult> => {
  const { features, sourceProjection, issues } = await parseGisSource(input);

  return {
    summary:
      features.length === 0
        ? null
        : summarizeFeatures(features, sourceProjection?.name),
    issues: issues.build(),
  };
};
