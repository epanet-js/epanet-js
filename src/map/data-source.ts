import { LinksAnalysis, NodesAnalysis } from "src/analysis";
import { AssetsMap, Junction, Pipe } from "src/hydraulic-model";
import { isFeatureOn } from "src/infra/feature-flags";
import { strokeColorFor } from "src/lib/color";
import { IDMap, UIDMap } from "src/lib/id_mapper";
import { convertTo } from "src/quantity";
import { AnalysisState } from "src/state/analysis";
import { Feature } from "src/types";

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
    if (isFeatureOn("FLAG_MAPBOX_JUNCTIONS") && asset.type === "junction")
      appendJunctionAnalysisProps(asset as Junction, feature, analysis.nodes);

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
  feature.properties!.color = colorMapper.hexaColor(value !== null ? value : 0);
  feature.properties!.length = convertTo(
    { value: pipe.length, unit: pipe.getUnit("length") },
    "m",
  );
  feature.properties!.hasArrow = pipe.status !== "closed" && value !== null;
  feature.properties!.rotation = isReverse ? -180 : 0;
};

const appendJunctionAnalysisProps = (
  junction: Junction,
  feature: Feature,
  nodesAnalysis: NodesAnalysis,
) => {
  if (nodesAnalysis.type === "none") return;

  const colorMapper = nodesAnalysis.rangeColorMapping;
  const property = colorMapper.symbolization.property;
  const value = junction[property as keyof Junction] as number | null;
  const fillColor = colorMapper.hexaColor(value !== null ? value : 0);
  feature.properties!.color = fillColor;
  feature.properties!.strokeColor = strokeColorFor(fillColor);
};

function pick(
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
