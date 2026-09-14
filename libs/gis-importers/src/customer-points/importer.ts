import type { Importer } from "../importer";
import { scanSource } from "../scan-source";
import { gisSourceExtensions } from "../file-parsers/formats";
import {
  importCustomerPointsFromSource,
  importCustomerPointsFromFeatures,
  type CustomerPointRole,
} from "./import-from-source";

export const customerPointsImporter: Importer<CustomerPointRole> = {
  name: "GIS",
  extensions: [...gisSourceExtensions],
  roles: ["label", "demand"],
  scanSource,
  importFromSource: importCustomerPointsFromSource,
  importFromFeatures: importCustomerPointsFromFeatures,
};
