import type { BBox, MultiPolygon } from "geojson";

export type ZoneId = number;

export type Zone = {
  id: ZoneId;
  label: string;
  geometry: MultiPolygon;
  bbox: BBox;
};

export type Zones = Map<ZoneId, Zone>;

export const isZoneLabelAvailable = (
  zones: Zones,
  label: string,
  excludeId?: ZoneId,
): boolean => {
  const normalizedLabel = label.toUpperCase();
  for (const zone of zones.values()) {
    if (zone.id === excludeId) continue;
    if (zone.label.toUpperCase() === normalizedLabel) return false;
  }
  return true;
};
