import type { BBox, MultiPolygon } from "geojson";

export type ZoneId = number;

export type ZoneProperties = {
  label: string;
};

export class Zone {
  public readonly id: ZoneId;
  public readonly geometry: MultiPolygon;
  public readonly bbox: BBox;
  private readonly properties: ZoneProperties;

  constructor(
    id: ZoneId,
    geometry: MultiPolygon,
    bbox: BBox,
    properties: ZoneProperties,
  ) {
    this.id = id;
    this.geometry = geometry;
    this.bbox = bbox;
    this.properties = { ...properties };
  }

  get label() {
    return this.properties.label;
  }

  setProperty(name: string, value: unknown) {
    this.properties[name as keyof ZoneProperties] = value as never;
  }

  getProperty(name: string) {
    return this.properties[name as keyof ZoneProperties];
  }

  listProperties() {
    return Object.keys(this.properties);
  }

  hasProperty(name: string): boolean {
    return name in this.properties;
  }
}

export type Zones = Map<ZoneId, Zone>;
