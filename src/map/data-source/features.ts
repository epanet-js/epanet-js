import { SymbologySpec, LinkSymbology, NodeSymbology } from "src/map/symbology";
import { AssetsMap, Junction, Pipe, Pump } from "src/hydraulic-model";
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

export const buildFeatureId = (assetId: AssetId) => assetId;

export const buildOptimizedAssetsSource = (
  assets: AssetsMap,
  symbology: SymbologySpec,
  quantities: Quantities,
  translateUnit: (unit: Unit) => string,
): Feature[] => {
  const strippedFeatures = [];
  const keepProperties: string[] = ["type", "isActive"];

  for (const asset of assets.values()) {
    if (asset.feature.properties?.visibility === false) {
      continue;
    }
    const featureId = buildFeatureId(asset.id);
    const feature: Feature = {
      type: "Feature",
      id: featureId,
      properties: pick(asset.feature.properties, keepProperties),
      geometry: asset.feature.geometry,
    };

    switch (asset.type) {
      case "pipe":
        appendPipeProps(
          asset as Pipe,
          feature,
          symbology.link,
          quantities,
          translateUnit,
        );
        break;
      case "junction":
        appendJunctionProps(
          asset as Junction,
          feature,
          symbology.node,
          quantities,
          translateUnit,
        );
        break;
      case "pump":
        appendPumpProps(asset as Pump, feature);
        break;
      case "valve":
        appendValveProps(asset as Valve, feature);
        break;
      case "tank":
      case "reservoir":
        break;
    }

    strippedFeatures.push(feature);
  }
  return strippedFeatures;
};

const appendPipeProps = (
  pipe: Pipe,
  feature: Feature,
  linkSymbology: LinkSymbology,
  quantities: Quantities,
  translateUnit: (unit: Unit) => string,
) => {
  appendPipeStatus(pipe, feature);
  appendPipeSymbologyProps(
    pipe,
    feature,
    linkSymbology,
    quantities,
    translateUnit,
  );
};

const appendJunctionProps = (
  junction: Junction,
  feature: Feature,
  nodeSymbology: NodeSymbology,
  quantities: Quantities,
  translateUnit: (unit: Unit) => string,
) => {
  appendJunctionSymbologyProps(
    junction,
    feature,
    nodeSymbology,
    quantities,
    translateUnit,
  );
};

const appendPumpProps = (pump: Pump, feature: Feature) => {
  appendPumpStatus(pump, feature);
};

const appendValveProps = (valve: Valve, feature: Feature) => {
  appendValveStatus(valve, feature);
};

export const appendPipeStatus = (pipe: Pipe, feature: Feature) => {
  feature.properties!.status = pipe.status ? pipe.status : pipe.initialStatus;
};

export const appendPumpStatus = (pump: Pump, feature: Feature) => {
  feature.properties!.status = pump.status ? pump.status : pump.initialStatus;
};

export const appendValveStatus = (valve: Valve, feature: Feature) => {
  feature.properties!.status = valve.status
    ? valve.status
    : valve.initialStatus;
};

export const appendPipeArrowProps = (pipe: Pipe, feature: Feature) => {
  const status = pipe.status ? pipe.status : pipe.initialStatus;
  const isReverse = pipe.flow && pipe.flow < 0;
  feature.properties!.length = convertTo(
    { value: pipe.length, unit: pipe.getUnit("length") },
    "m",
  );
  feature.properties!.hasArrow = status === "open" && pipe.flow !== null;
  feature.properties!.rotation = isReverse ? -180 : 0;
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
  appendPipeArrowProps(pipe, feature);
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
