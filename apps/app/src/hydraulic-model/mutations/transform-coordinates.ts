import { Position } from "geojson";
import { type NodeAsset, type LinkAsset } from "src/hydraulic-model";
import { AssetsMap } from "../assets-map";
import { CustomerPoints } from "../customer-points";

type TransformCoordinatesData = Pick<
  { assets: AssetsMap; customerPoints: CustomerPoints },
  "assets" | "customerPoints"
>;

export const transformCoordinates = (
  data: TransformCoordinatesData,
  transform: (p: Position) => Position,
) => {
  for (const asset of data.assets.values()) {
    if (asset.isNode) {
      const node = asset as NodeAsset;
      node.setCoordinates(transform(node.coordinates));
    } else {
      const link = asset as LinkAsset;
      link.setCoordinates(link.coordinates.map(transform));
    }
  }

  for (const cp of data.customerPoints.values()) {
    const transformed = transform(cp.coordinates);
    cp.coordinates[0] = transformed[0];
    cp.coordinates[1] = transformed[1];
    const connection = cp.connection;
    if (connection) {
      const transformedSnap = transform(connection.snapPoint);
      connection.snapPoint[0] = transformedSnap[0];
      connection.snapPoint[1] = transformedSnap[1];
    }
  }
};
