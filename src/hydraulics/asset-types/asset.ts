import { IFeature } from "src/types";
import { LineString, Point } from "geojson";

export type AssetId = StringId;

export type AssetGeometry = LineString | Point;

export type AssetAttributes = {
  type: "pipe" | "junction";
  visibility?: boolean;
};

export class Asset<T> {
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

  protected get attributes() {
    return this.feature.properties;
  }

  protected get geometry(): AssetGeometry {
    return this.feature.geometry;
  }
}
