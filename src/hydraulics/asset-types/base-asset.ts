import { IFeature } from "src/types";
import { LineString, Point } from "geojson";
import { Quantity } from "src/quantity";

export type AssetId = StringId;

type AssetGeometry = LineString | Point;

export type AssetAttributes = {
  type: "pipe" | "junction";
  visibility?: boolean;
};

export type QuantityAttribute = { type: "quantity" } & Quantity;
export type StatusAttribute<T> = {
  type: "status";
  value: T;
  options: readonly T[];
};

export class BaseAsset<T> {
  public readonly feature: IFeature<AssetGeometry, T & AssetAttributes>;
  public readonly id: AssetId;
  public readonly at = "any";
  public readonly folderId = "any";

  constructor(
    id: AssetId,
    geometry: AssetGeometry,
    attributes: T & AssetAttributes,
  ) {
    this.id = id;
    this.feature = {
      type: "Feature",
      geometry,
      properties: attributes,
    };
  }

  get type() {
    return this.feature.properties.type;
  }

  protected get attributes() {
    return this.feature.properties;
  }

  protected get geometry(): AssetGeometry {
    return this.feature.geometry;
  }
}
