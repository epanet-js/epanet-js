import type { GisInput, Importer } from "../importer";
import { parseGisSource } from "../file-parsers/parse-gis-source";
import { summarizeFeatures } from "../file-parsers/summarize";
import {
  importCustomerPointsSource,
  type CustomerPointRole,
} from "./import-source";

const scanSource = async (input: GisInput) => {
  const { features, originalProjection, issues } = await parseGisSource(input);
  const blocking = issues.build().some(({ severity }) => severity === "error");

  return {
    summary: blocking ? null : summarizeFeatures(features, originalProjection),
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
  importSource: importCustomerPointsSource,
};
