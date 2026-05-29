import type { MultiPolygon } from "geojson";
import type { BBox } from "@turf/helpers";

export type ZoneId = number;

export type Zone = {
  id: ZoneId;
  label: string;
  geometry: MultiPolygon;
  bbox: BBox;
  adjacentZones: ZoneId[];
};

export type Zones = Record<ZoneId, Zone>;

export const initializeZones = (): Zones => ({});
