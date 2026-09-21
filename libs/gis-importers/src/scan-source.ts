import type { GisInput, ScanSourceResult } from "./importer";
import { parseGisSource } from "./file-parsers/parse-gis-source";

export const scanSource = async (
  input: GisInput,
): Promise<ScanSourceResult> => {
  const parsed = await parseGisSource(input);
  const { features, sourceProjection, issues } = parsed;

  return {
    contents: features.length === 0 ? null : parsed.contents,
    ...(sourceProjection === undefined ? {} : { sourceProjection }),
    issues: issues.build(),
  };
};
