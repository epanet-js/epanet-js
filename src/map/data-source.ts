import { LinksAnalysis } from "src/analysis";
import { AssetsMap, Pipe } from "src/hydraulic-model";
import { SIMPLESTYLE_PROPERTIES } from "src/lib/constants";
import { IDMap, UIDMap } from "src/lib/id_mapper";
import { convertTo } from "src/quantity";
import { AnalysisState } from "src/state/analysis";
import { PreviewProperty } from "src/state/jotai";
import { Feature, ISymbolization, IWrappedFeature } from "src/types";

export type DataSource = "imported-features" | "features";

export const buildOptimizedAssetsSource = (
  assets: AssetsMap,
  idMap: IDMap,
  analysis: AnalysisState,
): Feature[] => {
  const strippedFeatures = [];
  const keepProperties: string[] = ["type", "status"];

  for (const asset of assets.values()) {
    if (asset.feature.properties?.visibility === false) {
      continue;
    }
    const featureId = UIDMap.getIntID(idMap, asset.id);
    const feature: Feature = {
      type: "Feature",
      id: featureId,
      properties: pick(asset.feature.properties, keepProperties),
      geometry: asset.feature.geometry,
    };

    if (asset.type === "pipe")
      appendPipeAnalysisProps(asset as Pipe, feature, analysis.links);

    strippedFeatures.push(feature);
  }
  return strippedFeatures;
};

const appendPipeAnalysisProps = (
  pipe: Pipe,
  feature: Feature,
  linkAnalysis: LinksAnalysis,
) => {
  if (linkAnalysis.type === "none") return;

  const colorMapper = linkAnalysis.rangeColorMapping;
  const property = colorMapper.symbolization.property;
  const value = pipe[property as keyof Pipe] as number | null;
  const isReverse = value && value < 0;
  feature.properties!.color = colorMapper.hexaColor(
    value !== null ? Math.abs(value) : 0,
  );
  feature.properties!.length = convertTo(
    { value: pipe.length, unit: pipe.getUnit("length") },
    "m",
  );
  feature.properties!.hasArrow = pipe.status !== "closed" && value !== null;
  feature.properties!.rotation = isReverse ? -180 : 0;
};

export const buildOptimizedAssetsSourceDeprecated = (
  assets: AssetsMap,
  idMap: IDMap,
  symbolization: ISymbolization | null,
  previewProperty?: PreviewProperty,
): Feature[] => {
  const strippedFeatures = [];
  const keepProperties = getKeepPropertiesDeprecated({
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

export const stripFeature = function ({
  wrappedFeature,
  keepProperties,
  idMap,
}: {
  wrappedFeature: IWrappedFeature;
  keepProperties: ReturnType<typeof getKeepPropertiesDeprecated>;
  idMap: IDMap;
}): Feature {
  return stripFeatureExcept(
    wrappedFeature,
    UIDMap.getIntID(idMap, wrappedFeature.id),
    keepProperties,
  );
};

export function getKeepPropertiesDeprecated({
  symbolization,
  previewProperty,
}: {
  symbolization: ISymbolization | null;
  previewProperty?: PreviewProperty;
}) {
  let keepProperties: string[] = ["type", "status"];
  if (previewProperty) {
    keepProperties.push(previewProperty);
  }

  if (symbolization?.simplestyle) {
    keepProperties = keepProperties.concat(SIMPLESTYLE_PROPERTIES);
  }

  switch (symbolization?.type) {
    case "ramp":
    case "categorical": {
      keepProperties.push(symbolization.property);
      break;
    }
    case "none":
    case undefined: {
      break;
    }
  }
  return keepProperties;
}

export function pick(
  properties: Feature["properties"],
  propertyNames: readonly string[],
) {
  // Bail if properties is null.
  if (!properties) return properties;

  // Shortcut if there are no properties to pull.
  if (propertyNames.length === 0) return null;

  let ret: null | Feature["properties"] = null;

  for (const name of propertyNames) {
    if (name in properties) {
      if (ret === null) {
        ret = {};
      }
      ret[name] = properties[name];
    }
  }

  return ret;
}
export const stripFeatureExcept = function stripFeature(
  feature: IWrappedFeature,
  id: number,
  properties: readonly string[],
): Feature {
  return {
    type: "Feature",
    id,
    properties: pick(feature.feature.properties, properties),
    geometry: feature.feature.geometry,
  };
};
