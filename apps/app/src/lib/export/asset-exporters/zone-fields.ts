import { getAttributes, type Zone } from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "src/hydraulic-model";
import type { AssetExportOptions } from "../types";

export const exportedZones = (
  hydraulicModel: HydraulicModel,
  options?: AssetExportOptions,
): Zone[] => {
  if (!options?.includeZones) return [];
  const filter = options.zoneIdFilter ?? null;
  return [...hydraulicModel.zones.values()].filter(
    (zone) => filter === null || filter.has(zone.id),
  );
};

export const zoneFieldKeys = (hydraulicModel: HydraulicModel): string[] => [
  "label",
  ...getAttributes(hydraulicModel.customAttributes, "zone").map(({ id }) => id),
];

export const zoneFieldValue = (
  zone: Zone,
  key: string,
): string | number | null =>
  key === "label"
    ? zone.label
    : ((zone.getProperty(key) as string | number | undefined) ?? null);
