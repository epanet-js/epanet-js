import { QuantitiesSpec, Quantity, Unit, convertTo } from "src/quantity";
import { AssetId, Junction, canonicalQuantitiesSpec } from "./asset-types";
import {
  JunctionQuantities,
  JunctionQuantity,
  junctionCanonicalSpec,
} from "./asset-types/junction";
import {
  Pipe,
  PipeQuantities,
  PipeQuantity,
  PipeStatus,
  pipeCanonicalSpec,
} from "./asset-types/pipe";
import { LinkConnections, nullConnections } from "./asset-types/link";
import { Position } from "geojson";
import {
  Reservoir,
  ReservoirQuantities,
  ReservoirQuantity,
  reservoirCanonicalSpec,
} from "./asset-types/reservoir";

type QuantityOrNumber = Quantity | number;

export type JunctionBuildData = {
  id?: AssetId;
  coordinates?: Position;
  elevation?: number;
  demand?: number;
};

export type PipeBuildData = {
  id?: AssetId;
  coordinates?: Position[];
  connections?: LinkConnections;
  status?: PipeStatus;
  diameter?: number;
  roughness?: number;
  minorLoss?: number;
  length?: number;
};

export type ReservoirBuildData = {
  id?: AssetId;
  coordinates?: Position;
  head?: number;
  relativeHead?: number;
  elevation?: number;
};

import { customAlphabet } from "nanoid";
import { isFeatureOn } from "src/infra/feature-flags";
import {
  AssetQuantitiesSpec,
  AssetUnitsByType,
  Quantities,
} from "./quantities";
const epanetCompatibleAlphabet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const nanoId = customAlphabet(epanetCompatibleAlphabet, 21);
const generateId = () => nanoId();

const noUnits = {};

export type DefaultQuantities = {
  pipe: Record<PipeQuantity, number>;
  junction: Record<JunctionQuantity, number>;
  reservoir: Record<ReservoirQuantity, number>;
};

export class AssetBuilder {
  private quantitiesSpec: AssetQuantitiesSpec;
  private units: AssetUnitsByType;
  private defaults: DefaultQuantities;

  constructor(quantitiesSpec = canonicalQuantitiesSpec) {
    const quantities = new Quantities(quantitiesSpec);
    this.quantitiesSpec = quantitiesSpec;
    this.units = quantities.units;
    this.defaults = quantities.defaults;
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
    if (isFeatureOn("FLAG_MODEL_UNITS")) {
      return new Pipe(
        id,
        coordinates,
        {
          type: "pipe",
          connections,
          status,
          length: this.getPipeValue("length", length),
          diameter: this.getPipeValue("diameter", diameter),
          minorLoss: this.getPipeValue("minorLoss", minorLoss),
          roughness: this.getPipeValue("roughness", roughness),
        },
        this.units.pipe,
      );
    } else {
      return new Pipe(
        id,
        coordinates,
        {
          type: "pipe",
          connections,
          status,
          length: this.getPipeValueDeprecated("length", length),
          diameter: this.getPipeValueDeprecated("diameter", diameter),
          minorLoss: this.getPipeValueDeprecated("minorLoss", minorLoss),
          roughness: this.getPipeValueDeprecated("roughness", roughness),
        },
        noUnits,
      );
    }
  }

  buildJunction({
    id = generateId(),
    coordinates = [0, 0],
    elevation,
    demand,
  }: JunctionBuildData = {}) {
    if (isFeatureOn("FLAG_MODEL_UNITS")) {
      return new Junction(
        id,
        coordinates,
        {
          type: "junction",
          elevation: this.getJunctionValue("elevation", elevation),
          demand: this.getJunctionValue("demand", demand),
        },
        this.units.junction,
      );
    } else {
      return new Junction(
        id,
        coordinates,
        {
          type: "junction",
          elevation: this.getJunctionValueDeprecated("elevation", elevation),
          demand: this.getJunctionValueDeprecated("demand", demand),
        },
        noUnits,
      );
    }
  }

  buildReservoir({
    id = generateId(),
    coordinates = [0, 0],
    elevation,
    head,
    relativeHead,
  }: ReservoirBuildData = {}) {
    if (isFeatureOn("FLAG_MODEL_UNITS")) {
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

      return new Reservoir(
        id,
        coordinates,
        {
          type: "reservoir",
          head: headValue,
          elevation: elevationValue,
        },
        this.units.reservoir,
      );
    } else {
      const elevationValue = this.getReservoirValueDeprecated(
        "elevation",
        elevation,
      );
      let headValue: number;
      if (head !== undefined) {
        headValue = this.getReservoirValueDeprecated("head", head);
      } else {
        const relativeHeadValue = this.getReservoirValueDeprecated(
          "relativeHead",
          relativeHead,
        );
        headValue = relativeHeadValue + elevationValue;
      }

      return new Reservoir(
        id,
        coordinates,
        {
          type: "reservoir",
          head: headValue,
          elevation: elevationValue,
        },
        noUnits,
      );
    }
  }

  private getPipeValue(name: PipeQuantity, candidate?: number) {
    if (candidate !== undefined) return candidate;

    return this.defaults.pipe[name];
  }

  private getPipeValueDeprecated(
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

  private getJunctionValue(name: JunctionQuantity, candidate?: number) {
    if (candidate !== undefined) return candidate;

    return this.defaults.junction[name];
  }

  private getJunctionValueDeprecated(
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

  private getReservoirValue(name: ReservoirQuantity, candidate?: number) {
    if (candidate !== undefined) return candidate;

    return this.defaults.reservoir[name];
  }

  private getReservoirValueDeprecated(
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
