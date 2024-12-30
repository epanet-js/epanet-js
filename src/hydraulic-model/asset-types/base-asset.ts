import { IFeature } from "src/types";
import { LineString, Point } from "geojson";
import { Unit } from "src/quantity";

export type AssetId = StringId;

type AssetGeometry = LineString | Point;

export type AssetProperties = {
  type: "pipe" | "junction" | "reservoir";
  visibility?: boolean;
};

export type AssetUnits = Record<string, Unit>;

export class BaseAsset<T> {
  public readonly feature: IFeature<AssetGeometry, T & AssetProperties>;
  public readonly id: AssetId;
  public readonly at = "any";
  public readonly folderId = "any";
  protected units: AssetUnits;

  constructor(
    id: AssetId,
    geometry: AssetGeometry,
    properties: T & AssetProperties,
    units: AssetUnits,
  ) {
    this.id = id;
    this.units = units;
    this.feature = {
      type: "Feature",
      geometry,
      properties,
    };
  }

  get type() {
    return this.feature.properties.type;
  }

  setProperty(name: string, value: number) {
    this.feature.properties[name as keyof AssetProperties] = value as never;
  }

  hasProperty(name: string): boolean {
    return this.feature.properties[name as keyof AssetProperties] !== undefined;
  }

  protected get properties() {
    return this.feature.properties;
  }

  protected get geometry(): AssetGeometry {
    return this.feature.geometry;
  }
}
