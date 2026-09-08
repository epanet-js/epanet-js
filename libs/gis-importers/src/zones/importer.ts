import type { Importer } from "../importer";
import { scanSource } from "../scan-source";
import {
  importZonesFromSource,
  importZonesFromFeatures,
  type ZoneRole,
} from "./import-from-source";

export const zonesImporter: Importer<ZoneRole> = {
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
  roles: ["label"],
  scanSource,
  importFromSource: importZonesFromSource,
  importFromFeatures: importZonesFromFeatures,
};
