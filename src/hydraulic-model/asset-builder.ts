import {
  QuantitiesSpec,
  QuantityMap,
  QuantityOrNumberMap,
  convertTo,
} from "src/quantity";
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
import {
  Pipe,
  PipeQuantities,
  PipeStatus,
  pipeCanonicalSpec,
} from "./asset-types/pipe";
import { LinkConnections, nullConnections } from "./asset-types/link";
import { Position } from "geojson";
import {
  Reservoir,
  ReservoirQuantities,
  reservoirCanonicalSpec,
} from "./asset-types/reservoir";

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

export type ReservoirBuildData = {
  id?: AssetId;
  coordinates?: Position;
} & Partial<
  QuantityOrNumberMap<ReservoirQuantities & { relativeHead: number }>
>;

import { customAlphabet } from "nanoid";
import { newFeatureId } from "src/lib/id";
import { isFeatureOn } from "src/infra/feature-flags";
const epanetCompatibleAlphabet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const nanoId = customAlphabet(epanetCompatibleAlphabet, 21);
const generateId = () => (isFeatureOn("FLAG_INP") ? nanoId() : newFeatureId());

export class AssetBuilder {
  private quantitiesSpec: AssetQuantitiesSpecByType;

  constructor(quantitiesSpec = canonicalQuantitiesSpec) {
    this.quantitiesSpec = quantitiesSpec;
  }

  buildPipe({
    id = generateId(),
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
    id = generateId(),
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

  buildReservoir({
    id = generateId(),
    coordinates = [0, 0],
    ...quantities
  }: ReservoirBuildData = {}) {
    const defaultQuantities = getDefaultQuantities(
      this.quantitiesSpec.reservoir,
    );

    const canonicalQuantities = canonalizeQuantities(
      { ...defaultQuantities, ...quantities },
      reservoirCanonicalSpec,
    );

    return new Reservoir(id, coordinates, {
      type: "reservoir",
      head:
        quantities.head !== undefined
          ? canonicalQuantities.head
          : canonicalQuantities.elevation + canonicalQuantities.relativeHead,
      elevation: canonicalQuantities.elevation,
    });
  }
}

const canonalizeQuantities = <T>(
  inputQuantities: Partial<QuantityOrNumberMap<T>>,
  canonicalSpec: QuantitiesSpec<T>,
): Record<keyof T, number> => {
  return Object.keys(inputQuantities).reduce(
    (acc, key) => {
      const typedKey = key as keyof T;
      const quantityOrNumber = inputQuantities[typedKey];
      const quantitySpec = canonicalSpec[key as keyof T];
      if (!quantitySpec) return acc;

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
  quantitiesSpec: QuantitiesSpec<T>,
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
