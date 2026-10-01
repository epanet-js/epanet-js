import type { MultiPolygon } from "geojson";
import type { ZoneData } from "../network-data";
import type { ZoneFactory, Zones } from "@epanet-js/hydraulic-model";

export type MergedZoneInfo = {
  label: string;
  featureCount: number;
};

export type BuildZonesResult = {
  zones: Zones;
  mergedZones: MergedZoneInfo[];
};

export const buildZones = (
  records: ZoneData[],
  zoneFactory: ZoneFactory,
): BuildZonesResult => {
  const zones: Zones = new Map();
  const mergedZones: MergedZoneInfo[] = [];

  const groups = new Map<string | ZoneData, ZoneData[]>();
  for (const record of records) {
    const key = record.label ?? record;
    const group = groups.get(key);
    if (group) group.push(record);
    else groups.set(key, [record]);
  }

  for (const [key, group] of groups) {
    const geometry: MultiPolygon = {
      type: "MultiPolygon",
      coordinates: group.flatMap((record) => record.polygons),
    };
    const zone = zoneFactory.create(
      geometry,
      typeof key === "string" ? key : undefined,
    );
    zones.set(zone.id, zone);

    if (group.length > 1) {
      mergedZones.push({ label: zone.label, featureCount: group.length });
    }
  }

  return { zones, mergedZones };
};
