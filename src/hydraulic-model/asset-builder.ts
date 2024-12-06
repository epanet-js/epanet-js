import { QuantitiesSpec, Quantity, Unit, convertTo } from "src/quantity";
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

type QuantityOrNumber = Quantity | number;

export type JunctionBuildData = {
  id?: AssetId;
  coordinates?: Position;
  elevation?: QuantityOrNumber;
  demand?: QuantityOrNumber;
};

export type PipeBuildData = {
  id?: AssetId;
  coordinates?: Position[];
  connections?: LinkConnections;
  status?: PipeStatus;
  diameter?: QuantityOrNumber;
  roughness?: QuantityOrNumber;
  minorLoss?: QuantityOrNumber;
  length?: QuantityOrNumber;
};

export type ReservoirBuildData = {
  id?: AssetId;
  coordinates?: Position;
  head?: QuantityOrNumber;
  relativeHead?: number;
  elevation?: QuantityOrNumber;
};

import { customAlphabet } from "nanoid";
const epanetCompatibleAlphabet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const nanoId = customAlphabet(epanetCompatibleAlphabet, 21);
const generateId = () => nanoId();

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
    length,
    diameter,
    minorLoss,
    roughness,
  }: PipeBuildData = {}) {
    return new Pipe(id, coordinates, {
      type: "pipe",
      connections,
      status,
      length: this.getPipeValue("length", length),
      diameter: this.getPipeValue("diameter", diameter),
      minorLoss: this.getPipeValue("minorLoss", minorLoss),
      roughness: this.getPipeValue("roughness", roughness),
    });
  }

  buildJunction({
    id = generateId(),
    coordinates = [0, 0],
    elevation,
    demand,
  }: JunctionBuildData = {}) {
    return new Junction(id, coordinates, {
      type: "junction",
      elevation: this.getJunctionValue("elevation", elevation),
      demand: this.getJunctionValue("demand", demand),
    });
  }

  buildReservoir({
    id = generateId(),
    coordinates = [0, 0],
    elevation,
    head,
    relativeHead,
  }: ReservoirBuildData = {}) {
    const elevationValue = this.getReservoirValue("elevation", elevation);
    let headValue: number;
    if (head !== undefined) {
      headValue = this.getReservoirValue("head", head);
    } else {
      const relativeHeadValue = this.getReservoirValue(
        "relativeHead",
        relativeHead,
      );
      headValue = relativeHeadValue + elevationValue;
    }

    return new Reservoir(id, coordinates, {
      type: "reservoir",
      head: headValue,
      elevation: elevationValue,
    });
  }

  private getPipeValue(
    name: keyof PipeQuantities,
    candidate?: QuantityOrNumber,
  ) {
    return getValueFor(
      candidate,
      pipeCanonicalSpec[name].unit,
      (this.quantitiesSpec.pipe as QuantitiesSpec<PipeQuantities>)[name]
        .defaultValue,
    );
  }

  private getJunctionValue(
    name: keyof JunctionQuantities,
    candidate?: QuantityOrNumber,
  ) {
    return getValueFor(
      candidate,
      junctionCanonicalSpec[name].unit,
      (this.quantitiesSpec.junction as QuantitiesSpec<JunctionQuantities>)[name]
        .defaultValue,
    );
  }

  private getReservoirValue(
    name: keyof ReservoirQuantities,
    candidate?: QuantityOrNumber,
  ) {
    return getValueFor(
      candidate,
      reservoirCanonicalSpec[name].unit,
      (this.quantitiesSpec.reservoir as QuantitiesSpec<ReservoirQuantities>)[
        name
      ].defaultValue,
    );
  }
}

const getValueFor = (
  quantityOrNumber: Quantity | number | undefined,
  targetUnit: Unit,
  defaultValue: number,
): number => {
  if (quantityOrNumber === undefined) return defaultValue;

  if (typeof quantityOrNumber === "object") {
    return convertTo(quantityOrNumber, targetUnit);
  }

  return quantityOrNumber;
};
