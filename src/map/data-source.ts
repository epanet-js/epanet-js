import { AssetsMap } from "src/hydraulics/assets-map";
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
  for (const feature of assets.values()) {
    if (feature.feature.properties?.visibility === false) {
      continue;
    }
    const strippedFeature = stripFeature({
      wrappedFeature: feature,
      keepProperties,
      idMap,
    });
    strippedFeatures.push(strippedFeature);
  }
  return strippedFeatures;
};
