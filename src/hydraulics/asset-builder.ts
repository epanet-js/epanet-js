import { QuantityMap, QuantityOrNumberMap, convertTo } from "src/quantity";
import {
  AssetId,
  AssetQuantitiesSpecByType,
  Junction,
  canonicalQuantitiesSpec,
} from "./asset-types";
import {
  JunctionQuantities,
  junctionCanonicalSpec,
} from "./asset-types/junction";
import { AssetQuantitiesSpec } from "./asset-types/asset-quantities";
import {
  Pipe,
  PipeQuantities,
  PipeStatus,
  pipeCanonicalSpec,
} from "./asset-types/pipe";
import { newFeatureId } from "src/lib/id";
import { LinkConnections, nullConnections } from "./asset-types/link";
import { Position } from "geojson";

export type JunctionBuildData = {
  id?: AssetId;
  coordinates?: Position;
} & Partial<QuantityOrNumberMap<JunctionQuantities>>;

export type PipeBuildData = {
  id?: AssetId;
  coordinates?: Position[];
  connections?: LinkConnections;
  status?: PipeStatus;
} & Partial<QuantityOrNumberMap<PipeQuantities>>;

export class AssetBuilder {
  private quantitiesSpec: AssetQuantitiesSpecByType;

  constructor(quantitiesSpec = canonicalQuantitiesSpec) {
    this.quantitiesSpec = quantitiesSpec;
  }

  buildPipe({
    id = newFeatureId(),
    coordinates = [
      [0, 0],
      [0, 0],
    ],
    connections = nullConnections,
    status = "open",
    ...quantities
  }: PipeBuildData = {}) {
    const defaultQuantities = getDefaultQuantities(this.quantitiesSpec.pipe);

    return new Pipe(id, coordinates, {
      type: "pipe",
      connections,
      status,
      ...canonalizeQuantities(
        { ...defaultQuantities, ...quantities },
        pipeCanonicalSpec,
      ),
    });
  }

  buildJunction({
    id = newFeatureId(),
    coordinates = [0, 0],
    ...quantities
  }: JunctionBuildData = {}) {
    const defaultQuantities = getDefaultQuantities(
      this.quantitiesSpec.junction,
    );

    return new Junction(id, coordinates, {
      type: "junction",
      ...canonalizeQuantities(
        { ...defaultQuantities, ...quantities },
        junctionCanonicalSpec,
      ),
    });
  }
}

const canonalizeQuantities = <T>(
  inputQuantities: Partial<QuantityOrNumberMap<T>>,
  canonicalSpec: AssetQuantitiesSpec<T>,
): Record<keyof T, number> => {
  return Object.keys(inputQuantities).reduce(
    (acc, key) => {
      const typedKey = key as keyof T;
      const quantityOrNumber = inputQuantities[typedKey];

      if (typeof quantityOrNumber === "object") {
        acc[typedKey] = convertTo(
          quantityOrNumber,
          canonicalSpec[key as keyof T].unit,
        );
        return acc;
      }

      const number = quantityOrNumber;
      acc[typedKey] = number as number;
      return acc;
    },
    {} as Record<keyof T, number>,
  );
};

const getDefaultQuantities = <T>(
  quantitiesSpec: AssetQuantitiesSpec<T>,
): QuantityMap<T> => {
  return Object.keys(quantitiesSpec).reduce((acc, key) => {
    const typedKey = key as keyof T;
    acc[typedKey] = {
      value: quantitiesSpec[typedKey].defaultValue,
      unit: quantitiesSpec[typedKey].unit,
    };
    return acc;
  }, {} as QuantityMap<T>);
};
