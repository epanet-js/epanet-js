import { SymbologySpec, LinkSymbology, NodeSymbology } from "src/map/symbology";
import { AssetsMap, Junction, Pipe, Pump } from "src/hydraulic-model";
import { Unit, convertTo } from "@epanet-js/quantity";
import { Feature } from "src/types";
import { Asset, AssetId, Valve } from "@epanet-js/hydraulic-model";
import { colorFor } from "src/map/symbology/range-color-rule";
import { strokeColorFor } from "src/lib/color";
import { localizeDecimal } from "src/infra/i18n/numbers";
import {
  FormattingSpec,
  UnitsSpec,
  QuantityProperty,
  getDecimals,
} from "src/lib/project-settings/quantities-spec";
import {
  type ResultsReader,
  type PipeSimulation,
  type JunctionSimulation,
} from "src/simulation/results-reader";
import { isSimulationProperty } from "src/map/symbology/symbology-data-source";
import { assetLabelRule } from "src/map/symbology/labeling";
import { LabelRule } from "src/map/symbology/symbology-types";
import { createTimeSlicer } from "src/infra/yield-to-main";

export const buildFeatureId = (assetId: AssetId) => assetId;

// Budget per synchronous slice of the asset loop before yielding. Small enough
// to leave most of a frame for rendering/input so a large network's build
// (100k+ assets) doesn't freeze pan/zoom; yieldToMain resumes immediately when
// nothing else is pending, so an idle build stays near full speed.
const BUILD_SLICE_MS = 8;

export const buildOptimizedAssetsSource = async (
  assets: AssetsMap,
  symbology: SymbologySpec,
  units: UnitsSpec,
  formatting: FormattingSpec,
  translateUnit: (unit: Unit) => string,
  simulationResults?: ResultsReader | null,
): Promise<Feature[]> => {
  const strippedFeatures = [];
  const keepProperties: string[] = ["type", "isActive"];
  const yieldIfSliceElapsed = createTimeSlicer(BUILD_SLICE_MS);

  for (const asset of assets.values()) {
    await yieldIfSliceElapsed();
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

    const isLink =
      asset.type === "pipe" || asset.type === "pump" || asset.type === "valve";
    const labelRule = isLink
      ? symbology.link.labelRule
      : symbology.node.labelRule;
    appendLabel(
      asset,
      feature,
      labelRule,
      units,
      formatting,
      translateUnit,
      simulationResults,
    );

    switch (asset.type) {
      case "pipe":
        appendPipeProps(
          asset as Pipe,
          feature,
          symbology.link,
          units,
          simulationResults,
        );
        break;
      case "junction":
        appendJunctionProps(
          asset as Junction,
          feature,
          symbology.node,
          simulationResults,
        );
        break;
      case "pump":
        appendPumpProps(asset as Pump, feature, simulationResults);
        break;
      case "valve":
        appendValveProps(asset as Valve, feature, simulationResults);
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
  units: UnitsSpec,
  simulationResults?: ResultsReader | null,
) => {
  appendPipeStatus(pipe, feature, simulationResults);
  appendPipeSymbologyProps(
    pipe,
    feature,
    linkSymbology,
    units,
    simulationResults,
  );
};

const appendJunctionProps = (
  junction: Junction,
  feature: Feature,
  nodeSymbology: NodeSymbology,
  simulationResults?: ResultsReader | null,
) => {
  appendJunctionSymbologyProps(
    junction,
    feature,
    nodeSymbology,
    simulationResults,
  );
};

const appendPumpProps = (
  pump: Pump,
  feature: Feature,
  simulationResults?: ResultsReader | null,
) => {
  appendPumpStatus(pump, feature, simulationResults);
};

const appendValveProps = (
  valve: Valve,
  feature: Feature,
  simulationResults?: ResultsReader | null,
) => {
  appendValveStatus(valve, feature, simulationResults);
};

export const appendPipeStatus = (
  pipe: Pipe,
  feature: Feature,
  simulationResults?: ResultsReader | null,
) => {
  const pipeSimulation = simulationResults?.getPipe(pipe.id);
  const status = pipeSimulation?.status ?? null;
  feature.properties!.status = status ? status : pipe.initialStatus;
};

export const appendPumpStatus = (
  pump: Pump,
  feature: Feature,
  simulationResults?: ResultsReader | null,
) => {
  const pumpSimulation = simulationResults?.getPump(pump.id);
  const status = pumpSimulation?.status ?? null;
  feature.properties!.status = status ? status : pump.initialStatus;
};

export const appendValveStatus = (
  valve: Valve,
  feature: Feature,
  simulationResults?: ResultsReader | null,
) => {
  const valveSimulation = simulationResults?.getValve(valve.id);
  const status = valveSimulation?.status ?? null;
  feature.properties!.status = status ? status : valve.initialStatus;
};

export const appendPipeArrowProps = (
  pipe: Pipe,
  feature: Feature,
  units: UnitsSpec,
  simulationResults?: ResultsReader | null,
) => {
  const pipeSimulation = simulationResults?.getPipe(pipe.id);
  const status = pipeSimulation?.status ?? null;
  const flow = pipeSimulation?.flow ?? null;
  const isReverse = flow && flow < 0;
  feature.properties!.length = convertTo(
    { value: pipe.length ?? 0, unit: units.length },
    "m",
  );
  feature.properties!.hasArrow =
    (status ?? pipe.initialStatus) === "open" && flow !== null;
  feature.properties!.rotation = isReverse ? -180 : 0;
};

const appendPipeSymbologyProps = (
  pipe: Pipe,
  feature: Feature,
  linkSymbology: LinkSymbology,
  units: UnitsSpec,
  simulationResults?: ResultsReader | null,
) => {
  if (!linkSymbology.colorRule) return;

  const property = linkSymbology.colorRule.property;
  const isSimProperty = isSimulationProperty(property);

  let value: number | null;
  if (isSimProperty) {
    const pipeSimulation = simulationResults?.getPipe(pipe.id);
    value = pipeSimulation
      ? (pipeSimulation[property as keyof PipeSimulation] as number)
      : null;
  } else {
    value = pipe[property as keyof Pipe] as number | null;
  }
  if (isSimProperty || value !== null) {
    feature.properties!.color = colorFor(linkSymbology.colorRule, value ?? 0);
  }
  appendPipeArrowProps(pipe, feature, units, simulationResults);
};

// Maps symbology property names to simulation property names
const getJunctionSimProperty = (property: string): keyof JunctionSimulation => {
  if (property === "actualDemand") return "demand";
  return property as keyof JunctionSimulation;
};

const appendJunctionSymbologyProps = (
  junction: Junction,
  feature: Feature,
  nodeSymbology: NodeSymbology,
  simulationResults?: ResultsReader | null,
) => {
  if (!nodeSymbology.colorRule) return;

  const property = nodeSymbology.colorRule.property;
  const isSimProperty = isSimulationProperty(property);

  let value: number | null;
  if (isSimProperty) {
    const junctionSimulation = simulationResults?.getJunction(junction.id);
    const simProperty = getJunctionSimProperty(property);
    value = junctionSimulation
      ? (junctionSimulation[simProperty] as number)
      : null;
  } else {
    value = junction[property as keyof Junction] as number | null;
  }
  if (isSimProperty || value !== null) {
    const fillColor = colorFor(nodeSymbology.colorRule, value ?? 0);
    feature.properties!.color = fillColor;
    feature.properties!.strokeColor = strokeColorFor(fillColor);
  }
};

const appendLabel = (
  asset: Asset,
  feature: Feature,
  labelRule: LabelRule | null,
  units: UnitsSpec,
  formatting: FormattingSpec,
  translateUnit: (unit: Unit) => string,
  simulationResults?: ResultsReader | null,
) => {
  if (!labelRule) return;

  if (labelRule === assetLabelRule) {
    feature.properties!.label = asset.label;
    return;
  }

  const property = labelRule;
  let value: number | null = null;

  if (isSimulationProperty(property)) {
    if (asset.type === "pipe") {
      const sim = simulationResults?.getPipe(asset.id);
      value = sim ? (sim[property as keyof PipeSimulation] as number) : null;
    } else if (asset.type === "junction") {
      const simProperty = getJunctionSimProperty(property);
      const sim = simulationResults?.getJunction(asset.id);
      value = sim ? (sim[simProperty] as number) : null;
    }
  } else {
    value =
      (asset as unknown as Record<string, number | null>)[property] ?? null;
  }

  if (value === null) return;

  const unit = units[property as QuantityProperty];
  const localizedNumber = localizeDecimal(value, {
    decimals: getDecimals(formatting, property as QuantityProperty),
  });
  const unitText = unit ? translateUnit(unit) : "";
  feature.properties!.label = `${localizedNumber} ${unitText}`;
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
