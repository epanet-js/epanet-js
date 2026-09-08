import type { Importer } from "../importer";
import { scanSource } from "../scan-source";
import {
  importCustomerPointsFromSource,
  importCustomerPointsFromFeatures,
  type CustomerPointRole,
} from "./import-from-source";

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
