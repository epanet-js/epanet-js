import { Position, HandlerContext } from "src/types";
import { AssetsGeoIndex } from "src/hydraulic-model/assets-geo";
import { queryContainedAssets } from "src/hydraulic-model/spatial-queries";
import { useSelection } from "src/selection";

export const useAreaSelection = (context: HandlerContext) => {
  const { selection, hydraulicModel } = context;
  const { selectAssets } = useSelection(selection);

  const selectContainedAssets = (points: Position[]): void => {
    const assetsGeo = new AssetsGeoIndex(
      hydraulicModel.assets,
      hydraulicModel.assetIndex,
    );
    const assetIds = queryContainedAssets(assetsGeo, points);
    if (assetIds.length > 0) {
      selectAssets(assetIds);
    }
  };

  return selectContainedAssets;
};
