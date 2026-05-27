import type { MultiPolygon } from "geojson";

export type ZoneId = number;

export type Zone = {
  id: ZoneId;
  label: string;
  geometry: MultiPolygon;
};

export type Zones = Record<ZoneId, Zone>;

export const initializeZones = (): Zones => ({});
