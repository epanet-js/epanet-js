import type { GisInput, Importer } from "../importer";
import { parseGisSource } from "../file-parsers/parse-gis-source";
import { summarizeFeatures } from "../file-parsers/summarize";
import {
  importCustomerPointsFromSource,
  importCustomerPointsFromFeatures,
  type CustomerPointRole,
} from "./import-from-source";

const scanSource = async (input: GisInput) => {
  const { features, originalProjection, issues } = await parseGisSource(input);

  return {
    summary:
      features.length === 0
        ? null
        : summarizeFeatures(features, originalProjection),
    issues: issues.build(),
  };
};

export const customerPointsImporter: Importer<CustomerPointRole> = {
  name: "GIS",
  extensions: [
    ".geojson",
    ".json",
    ".geojsonl",
    ".shp",
    ".dbf",
    ".prj",
    ".cpg",
  ],
  roles: ["label", "demand"],
  scanSource,
  importFromSource: importCustomerPointsFromSource,
  importFromFeatures: importCustomerPointsFromFeatures,
};
