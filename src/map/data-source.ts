import { AssetsMap } from "src/hydraulic-model";
import { IDMap } from "src/lib/id_mapper";
import { getKeepProperties, stripFeature } from "src/lib/pmap/strip_features";
import { PreviewProperty } from "src/state/jotai";
import { Feature, ISymbolization } from "src/types";

export type DataSource = "imported-features" | "features";

export const buildOptimizedAssetsSource = (
  assets: AssetsMap,
  idMap: IDMap,
  symbolization: ISymbolization | null,
  previewProperty: PreviewProperty,
): Feature[] => {
  const strippedFeatures = [];
  const keepProperties = getKeepProperties({
    symbolization,
    previewProperty,
  });
  for (const asset of assets.values()) {
    if (asset.feature.properties?.visibility === false) {
      continue;
    }

    const strippedFeature = stripFeature({
      wrappedFeature: asset,
      keepProperties,
      idMap,
    });
    strippedFeatures.push(strippedFeature);
  }
  return strippedFeatures;
};
