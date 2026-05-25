import type { Polygon, MultiPolygon } from "geojson";

export type ZoneId = number;

export class Zone {
  public readonly id: ZoneId;
  public readonly label: string;
  public readonly geometry: Polygon | MultiPolygon;

  constructor(
    id: ZoneId,
    geometry: Polygon | MultiPolygon,
    properties: { label: string },
  ) {
    this.id = id;
    this.label = properties.label;
    this.geometry = geometry;
  }

  copy(): Zone {
    return new Zone(this.id, structuredClone(this.geometry), {
      label: this.label,
    });
  }
}

export class Zones extends Map<ZoneId, Zone> {}

export const initializeZones = (): Zones => new Map();
