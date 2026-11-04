import type { BBox, MultiPolygon } from "geojson";

export type ZoneId = number;

export type Zone = {
  id: ZoneId;
  label: string;
  geometry: MultiPolygon;
  bbox: BBox;
};

export type Zones = Map<ZoneId, Zone>;
