import type { Importer } from "../importer";
import { scanSource } from "../scan-source";
import { gisSourceExtensions } from "../file-parsers/formats";
import {
  importZonesFromSource,
  importZonesFromFeatures,
  type ZoneRole,
} from "./import-from-source";

export const zonesImporter: Importer<ZoneRole> = {
  name: "GIS",
  extensions: [...gisSourceExtensions],
  roles: ["label"],
  scanSource,
  importFromSource: importZonesFromSource,
  importFromFeatures: importZonesFromFeatures,
};
