import { AnalysisState, LinkSymbology, NodeSymbology } from "src/analysis";
import { AssetId, AssetsMap, Junction, Pipe, Pump } from "src/hydraulic-model";
import { findLargestSegment } from "src/hydraulic-model/asset-types/link";
import { IDMap, UIDMap } from "src/lib/id_mapper";
import { convertTo } from "src/quantity";
import { Feature } from "src/types";
import calculateMidpoint from "@turf/midpoint";
import calculateBearing from "@turf/bearing";
import { Valve } from "src/hydraulic-model/asset-types";
import { controlKinds } from "src/hydraulic-model/asset-types/valve";
import { colorFor } from "src/analysis/range-symbology";
import { strokeColorFor } from "src/lib/color";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { translateUnit } from "src/infra/i18n";
import {
  Quantities,
  QuantityProperty,
} from "src/model-metadata/quantities-spec";
import { JunctionQuantity } from "src/hydraulic-model/asset-types/junction";

export type DataSource = "imported-features" | "features" | "icons";

export const buildOptimizedAssetsSource = (
  assets: AssetsMap,
  idMap: IDMap,
  analysis: AnalysisState,
  quantities: Quantities,
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
      appendPipeAnalysisProps(
        asset as Pipe,
        feature,
        analysis.links,
        quantities,
      );
    if (asset.type === "junction")
      appendJunctionAnalysisProps(
        asset as Junction,
        feature,
        analysis.nodes,
        quantities,
      );
    if (asset.type === "pump") {
      const pump = asset as Pump;
      feature.properties!.status = pump.status
        ? pump.status
        : pump.initialStatus;
    }
    if (asset.type === "valve") {
      const valve = asset as Valve;
      feature.properties!.status = valve.status
        ? valve.status
        : valve.initialStatus;
    }

    strippedFeatures.push(feature);
  }
  return strippedFeatures;
};

export const buildIconPointsSource = (
  assets: AssetsMap,
  idMap: IDMap,
  selectedAssets: Set<AssetId>,
): Feature[] => {
  const strippedFeatures = [];

  for (const asset of assets.values()) {
    if (asset.type === "pump") {
      const pump = asset as Pump;
      const featureId = UIDMap.getIntID(idMap, asset.id);
      const largestSegment = findLargestSegment(pump);
      const center = calculateMidpoint(...largestSegment);
      const bearing = calculateBearing(...largestSegment);

      const feature: Feature = {
        type: "Feature",
        id: featureId,
        properties: {
          type: pump.type,
          status: pump.status ? pump.status : pump.initialStatus,
          rotation: bearing,
          selected: selectedAssets.has(pump.id),
        },
        geometry: {
          type: "Point",
          coordinates: center.geometry.coordinates,
        },
      };
      strippedFeatures.push(feature);
    }

    if (asset.type === "valve") {
      const valve = asset as Valve;
      const featureId = UIDMap.getIntID(idMap, asset.id);
      const largestSegment = findLargestSegment(valve);
      const center = calculateMidpoint(...largestSegment);
      const bearing = calculateBearing(...largestSegment);

      const status = valve.status ? valve.status : valve.initialStatus;

      const feature: Feature = {
        type: "Feature",
        id: featureId,
        properties: {
          type: valve.type,
          kind: valve.kind,
          icon: `valve-${valve.kind}-${status}`,
          rotation: bearing,
          selected: selectedAssets.has(valve.id),
          isControlValve: controlKinds.includes(valve.kind),
        },
        geometry: {
          type: "Point",
          coordinates: center.geometry.coordinates,
        },
      };
      strippedFeatures.push(feature);
    }
  }
  return strippedFeatures;
};

const appendPipeAnalysisProps = (
  pipe: Pipe,
  feature: Feature,
  linkSymbology: LinkSymbology,
  quantities: Quantities,
) => {
  if (linkSymbology.type === "none") return;

  const property = linkSymbology.colorRule.property;

  const value = pipe[property as keyof Pipe] as number | null;
  const isReverse = pipe.flow && pipe.flow < 0;
  const numericValue = value !== null ? value : 0;

  if (!!linkSymbology.label) {
    const labelProperty = linkSymbology.label;
    const unit = pipe.getUnit(labelProperty);
    const localizedNumber = localizeDecimal(numericValue, {
      decimals: quantities.getDecimals(labelProperty as QuantityProperty),
    });
    const unitText = unit ? translateUnit(unit) : "";
    feature.properties!.label = `${localizedNumber} ${unitText}`;
  }
  feature.properties!.color = colorFor(linkSymbology.colorRule, numericValue);
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
  nodeSymbology: NodeSymbology,
  quantities: Quantities,
) => {
  if (nodeSymbology.type === "none") return;

  const property = nodeSymbology.colorRule.property;
  const value = junction[property as keyof Junction] as number | null;
  const numericValue = value !== null ? value : 0;

  if (!!nodeSymbology.label) {
    const unit = junction.getUnit(property as JunctionQuantity);
    const localizedNumber = localizeDecimal(numericValue, {
      decimals: quantities.getDecimals(property as QuantityProperty),
    });
    const unitText = unit ? translateUnit(unit) : "";
    feature.properties!.label = `${localizedNumber} ${unitText}`;
  }

  const fillColor = colorFor(nodeSymbology.colorRule, numericValue);
  const strokeColor = strokeColorFor(fillColor);

  feature.properties!.color = fillColor;
  feature.properties!.strokeColor = strokeColor;
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
