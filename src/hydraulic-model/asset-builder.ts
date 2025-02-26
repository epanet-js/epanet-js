import { AssetId, Junction } from "./asset-types";
import { JunctionQuantity } from "./asset-types/junction";
import { Pipe, PipeQuantity, PipeStatus } from "./asset-types/pipe";
import { LinkConnections, nullConnections } from "./asset-types/link";
import { Position } from "geojson";
import { Reservoir, ReservoirQuantity } from "./asset-types/reservoir";

export type JunctionBuildData = {
  id?: AssetId;
  label?: string;
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
import { UnitsSpec } from "src/model-metadata/quantities-spec";
const epanetCompatibleAlphabet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const nanoId = customAlphabet(epanetCompatibleAlphabet, 21);
const generateId = () => nanoId();

export type DefaultQuantities = {
  pipe: Partial<Record<PipeQuantity, number>>;
  junction: Partial<Record<JunctionQuantity, number>>;
  reservoir: Partial<Record<ReservoirQuantity | "relativeHead", number>>;
};

export class AssetBuilder {
  private units: UnitsSpec;
  private defaults: DefaultQuantities;

  constructor(units: UnitsSpec, defaults: DefaultQuantities) {
    this.units = units;
    this.defaults = defaults;
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
      this.units,
    );
  }

  buildJunction({
    id = generateId(),
    label = "",
    coordinates = [0, 0],
    elevation,
    demand,
  }: JunctionBuildData = {}) {
    return new Junction(
      id,
      coordinates,
      {
        type: "junction",
        label,
        elevation: this.getJunctionValue("elevation", elevation),
        demand: this.getJunctionValue("demand", demand),
      },
      this.units,
    );
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

    return new Reservoir(
      id,
      coordinates,
      {
        type: "reservoir",
        head: headValue,
        elevation: elevationValue,
      },
      this.units,
    );
  }

  private getPipeValue(name: PipeQuantity, candidate?: number) {
    if (candidate !== undefined) return candidate;

    return this.defaults.pipe[name] || 0;
  }

  private getJunctionValue(name: JunctionQuantity, candidate?: number) {
    if (candidate !== undefined) return candidate;

    return this.defaults.junction[name] || 0;
  }

  private getReservoirValue(
    name: ReservoirQuantity | "relativeHead",
    candidate?: number,
  ) {
    if (candidate !== undefined) return candidate;

    return this.defaults.reservoir[name] || 0;
  }
}
