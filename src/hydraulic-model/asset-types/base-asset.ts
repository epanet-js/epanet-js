import { IFeature } from "src/types";
import { LineString, Point } from "geojson";
import { Unit } from "src/quantity";
import { AssetType } from "./types";

export type AssetId = StringId;
export type InternalId = number;

type AssetGeometry = LineString | Point;

export type AssetProperties = {
  type: AssetType;
  visibility?: boolean;
  label: string;
};

export type AssetUnits = Record<string, Unit>;

export class BaseAsset<T> {
  public readonly feature: IFeature<AssetGeometry, T & AssetProperties>;
  public readonly id: AssetId;
  public readonly internalId: InternalId;
  public readonly at = "any";
  public readonly folderId = "any";
  protected units: AssetUnits;

  constructor(
    id: AssetId,
    internalId: InternalId,
    geometry: AssetGeometry,
    properties: T & AssetProperties,
    units: AssetUnits,
  ) {
    this.id = id;
    this.internalId = internalId;
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

  get label() {
    return this.feature.properties.label;
  }

  setProperty(name: string, value: number | string | boolean) {
    this.feature.properties[name as keyof AssetProperties] = value as never;
  }

  getProperty(name: string) {
    return this.feature.properties[name as keyof AssetProperties];
  }

  listProperties() {
    return Object.keys(this.feature.properties);
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
