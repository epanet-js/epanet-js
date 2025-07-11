import { SymbologySpec, LinkSymbology, NodeSymbology } from "src/map/symbology";
import { AssetsMap, Junction, Pipe, Pump } from "src/hydraulic-model";
import { IDMap, UIDMap } from "src/lib/id-mapper";
import { Unit, convertTo } from "src/quantity";
import { Feature } from "src/types";
import { AssetId, Valve } from "src/hydraulic-model/asset-types";
import { colorFor } from "src/map/symbology/range-color-rule";
import { strokeColorFor } from "src/lib/color";
import { localizeDecimal } from "src/infra/i18n/numbers";
import {
  Quantities,
  QuantityProperty,
} from "src/model-metadata/quantities-spec";
import { JunctionQuantity } from "src/hydraulic-model/asset-types/junction";

export const buildFeatureId = (idMap: IDMap, assetId: AssetId) =>
  UIDMap.getIntID(idMap, assetId);

export const buildOptimizedAssetsSource = (
  assets: AssetsMap,
  idMap: IDMap,
  symbology: SymbologySpec,
  quantities: Quantities,
  translateUnit: (unit: Unit) => string,
): Feature[] => {
  const strippedFeatures = [];
  const keepProperties: string[] = ["type", "status"];

  for (const asset of assets.values()) {
    if (asset.feature.properties?.visibility === false) {
      continue;
    }
    const featureId = buildFeatureId(idMap, asset.id);
    const feature: Feature = {
      type: "Feature",
      id: featureId,
      properties: pick(asset.feature.properties, keepProperties),
      geometry: asset.feature.geometry,
    };

    if (asset.type === "pipe")
      appendPipeSymbologyProps(
        asset as Pipe,
        feature,
        symbology.link,
        quantities,
        translateUnit,
      );
    if (asset.type === "junction")
      appendJunctionSymbologyProps(
        asset as Junction,
        feature,
        symbology.node,
        quantities,
        translateUnit,
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

const appendPipeSymbologyProps = (
  pipe: Pipe,
  feature: Feature,
  linkSymbology: LinkSymbology,
  quantities: Quantities,
  translateUnit: (unit: Unit) => string,
) => {
  if (!linkSymbology.colorRule) return;

  const property = linkSymbology.colorRule.property;

  const value = pipe[property as keyof Pipe] as number | null;
  const isReverse = pipe.flow && pipe.flow < 0;
  const numericValue = value !== null ? value : 0;

  if (!!linkSymbology.labelRule) {
    const labelProperty = linkSymbology.labelRule;
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

const appendJunctionSymbologyProps = (
  junction: Junction,
  feature: Feature,
  nodeSymbology: NodeSymbology,
  quantities: Quantities,
  translateUnit: (unit: Unit) => string,
) => {
  if (!nodeSymbology.colorRule) return;

  const property = nodeSymbology.colorRule.property;
  const value = junction[property as keyof Junction] as number | null;
  const numericValue = value !== null ? value : 0;

  if (!!nodeSymbology.labelRule) {
    const labelProperty = nodeSymbology.labelRule;
    const unit = junction.getUnit(labelProperty as JunctionQuantity);
    const localizedNumber = localizeDecimal(numericValue, {
      decimals: quantities.getDecimals(labelProperty as QuantityProperty),
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
