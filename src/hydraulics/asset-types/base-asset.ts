import { IFeature } from "src/types";
import { LineString, Point } from "geojson";
import { Quantity } from "src/quantity";

export type AssetId = StringId;

type AssetGeometry = LineString | Point;

export type AssetProperties = {
  type: "pipe" | "junction" | "reservoir";
  visibility?: boolean;
};

export type QuantityProperty = { type: "quantity" } & Quantity;
export type StatusProperty<T> = {
  type: "status";
  value: T;
  options: readonly T[];
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

  protected get properties() {
    return this.feature.properties;
  }

  protected get geometry(): AssetGeometry {
    return this.feature.geometry;
  }
}
