import type { IWrappedFeature, Feature, ISymbolization } from "src/types";
import { SIMPLESTYLE_PROPERTIES } from "src/lib/constants";
import { IDMap, UIDMap } from "src/lib/id_mapper";
import { PreviewProperty } from "src/state/jotai";

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

export function getKeepProperties({
  symbolization,
  previewProperty,
}: {
  symbolization: ISymbolization | null;
  previewProperty: PreviewProperty;
}) {
  let keepProperties: string[] = [];
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

export const stripFeature = function ({
  wrappedFeature,
  keepProperties,
  idMap,
}: {
  wrappedFeature: IWrappedFeature;
  keepProperties: ReturnType<typeof getKeepProperties>;
  idMap: IDMap;
}): Feature {
  return stripFeatureExcept(
    wrappedFeature,
    UIDMap.getIntID(idMap, wrappedFeature.id),
    keepProperties,
  );
};
