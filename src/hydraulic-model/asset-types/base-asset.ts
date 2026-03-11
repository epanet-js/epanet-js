import { IFeature } from "src/types";
import { LineString, Point } from "geojson";
import { AssetType } from "./types";

export type AssetId = number;
export const NO_ASSET_ID = 0;

type AssetGeometry = LineString | Point;

export type AssetProperties = {
  type: AssetType;
  visibility?: boolean;
  label: string;
  isActive: boolean;
};

export class BaseAsset<T> {
  public readonly feature: IFeature<AssetGeometry, T & AssetProperties>;
  public readonly id: AssetId;
  public readonly at = "any";
  public readonly folderId = "any";

  constructor(
    id: AssetId,
    geometry: AssetGeometry,
    properties: T & AssetProperties,
  ) {
    this.id = id;
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

  get isActive() {
    return this.feature.properties.isActive;
  }

  setProperty(name: string, value: unknown) {
    this.feature.properties[name as keyof AssetProperties] = value as never;
  }

  getProperty(name: string) {
    return this.feature.properties[name as keyof AssetProperties];
  }

  listProperties() {
    return Object.keys(this.feature.properties);
  }

  hasProperty(name: string): boolean {
    return name in this.feature.properties;
  }

  protected get properties() {
    return this.feature.properties;
  }

  protected get geometry(): AssetGeometry {
    return this.feature.geometry;
  }
}
