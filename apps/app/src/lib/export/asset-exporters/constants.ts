import { ExportedAssetTypes } from "../types";

export const FILE_NAMES: Record<ExportedAssetTypes, string> = {
  junction: "junctions",
  reservoir: "reservoirs",
  tank: "tanks",
  pipe: "pipes",
  pump: "pumps",
  valve: "valves",
  customerPoint: "customer-points",
};

export const ZONES_FILE_NAME = "zones";
