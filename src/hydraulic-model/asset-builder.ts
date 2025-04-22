import { AssetId, Junction, Pump } from "./asset-types";
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
  label?: string;
  coordinates?: Position[];
  connections?: LinkConnections;
  status?: PipeStatus;
  diameter?: number;
  roughness?: number;
  minorLoss?: number;
  length?: number;
};

export type PumpBuildData = {
  id?: AssetId;
  label?: string;
  initialStatus?: PumpStatus;
  coordinates?: Position[];
  connections?: LinkConnections;
  definitionType?: PumpDefintionType;
  designHead?: number;
  designFlow?: number;
  power?: number;
  speed?: number;
};

export type ValveBuildData = {
  id?: AssetId;
  label?: string;
  diameter?: number;
  minorLoss?: number;
  coordinates?: Position[];
  connections?: LinkConnections;
};

export type ReservoirBuildData = {
  id?: AssetId;
  label?: string;
  coordinates?: Position;
  head?: number;
  relativeHead?: number;
  elevation?: number;
};

import { UnitsSpec } from "src/model-metadata/quantities-spec";
import { IdGenerator } from "./id-generator";
import { LabelGenerator } from "./label-manager";
import {
  PumpDefintionType,
  PumpQuantity,
  PumpStatus,
} from "./asset-types/pump";
import { Valve, ValveQuantity } from "./asset-types/valve";

export type DefaultQuantities = {
  pipe: Partial<Record<PipeQuantity, number>>;
  junction: Partial<Record<JunctionQuantity, number>>;
  reservoir: Partial<Record<ReservoirQuantity | "relativeHead", number>>;
  pump: Partial<Record<PumpQuantity, number>>;
  valve: Partial<Record<ValveQuantity, number>>;
};

export class AssetBuilder {
  private units: UnitsSpec;
  private defaults: DefaultQuantities;
  private idGenerator: IdGenerator;
  readonly labelGenerator: LabelGenerator;

  constructor(
    units: UnitsSpec,
    defaults: DefaultQuantities,
    idGenerator: IdGenerator,
    labelGenerator: LabelGenerator,
  ) {
    this.units = units;
    this.defaults = defaults;
    this.idGenerator = idGenerator;
    this.labelGenerator = labelGenerator;
  }

  buildPipe({
    id = this.idGenerator.newId(),
    label,
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
        label:
          label !== undefined
            ? label
            : this.labelGenerator.generateFor("pipe", id),
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

  buildValve({
    id = this.idGenerator.newId(),
    label,
    coordinates = [
      [0, 0],
      [0, 0],
    ],
    connections = nullConnections,
    diameter,
    minorLoss,
  }: ValveBuildData = {}) {
    return new Valve(
      id,
      coordinates,
      {
        type: "valve",
        label:
          label !== undefined
            ? label
            : this.labelGenerator.generateFor("valve", id),
        connections,
        length: 10,
        diameter: this.getValveValue("diameter", diameter),
        minorLoss: this.getValveValue("minorLoss", minorLoss),
      },
      this.units,
    );
  }

  buildPump({
    id = this.idGenerator.newId(),
    label,
    coordinates = [
      [0, 0],
      [0, 0],
    ],
    initialStatus = "on",
    connections = nullConnections,
    definitionType = "flow-vs-head",
    designHead,
    designFlow,
    power,
    speed = 1,
  }: PumpBuildData = {}) {
    return new Pump(
      id,
      coordinates,
      {
        type: "pump",
        label:
          label !== undefined
            ? label
            : this.labelGenerator.generateFor("pump", id),
        connections,
        length: 10,
        initialStatus,
        definitionType,
        designHead: this.getPumpValue("designHead", designHead),
        designFlow: this.getPumpValue("designFlow", designFlow),
        power: this.getPumpValue("power", power),
        speed,
      },
      this.units,
    );
  }

  buildJunction({
    id = this.idGenerator.newId(),
    label,
    coordinates = [0, 0],
    elevation,
    demand,
  }: JunctionBuildData = {}) {
    return new Junction(
      id,
      coordinates,
      {
        type: "junction",
        label:
          label !== undefined
            ? label
            : this.labelGenerator.generateFor("junction", id),
        elevation: this.getJunctionValue("elevation", elevation),
        demand: this.getJunctionValue("demand", demand),
      },
      this.units,
    );
  }

  buildReservoir({
    id = this.idGenerator.newId(),
    label,
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
        label:
          label !== undefined
            ? label
            : this.labelGenerator.generateFor("reservoir", id),
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

  private getPumpValue(name: PumpQuantity, candidate?: number) {
    if (candidate !== undefined) return candidate;

    return this.defaults.pump[name] || 0;
  }

  private getValveValue(name: ValveQuantity, candidate?: number) {
    if (candidate !== undefined) return candidate;

    return this.defaults.valve[name] || 0;
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
