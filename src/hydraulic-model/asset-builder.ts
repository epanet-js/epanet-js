import { AssetId, Junction, Pump } from "./asset-types";
import { JunctionQuantity } from "./asset-types/junction";
import { Pipe, PipeQuantity, PipeStatus } from "./asset-types/pipe";
import { LinkConnections, nullConnections } from "./asset-types/link";
import { Position } from "geojson";
import { Reservoir, ReservoirQuantity } from "./asset-types/reservoir";
import { Tank, TankQuantity } from "./asset-types/tank";

export type JunctionBuildData = {
  id?: AssetId;
  internalId?: number;
  label?: string;
  coordinates?: Position;
  elevation?: number;
  baseDemand?: number;
};

export type PipeBuildData = {
  id?: AssetId;
  internalId?: number;
  label?: string;
  coordinates?: Position[];
  connections?: LinkConnections;
  initialStatus?: PipeStatus;
  diameter?: number;
  roughness?: number;
  minorLoss?: number;
  length?: number;
};

export type PumpBuildData = {
  id?: AssetId;
  internalId?: number;
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
  internalId?: number;
  label?: string;
  diameter?: number;
  minorLoss?: number;
  coordinates?: Position[];
  connections?: LinkConnections;
  kind?: ValveKind;
  setting?: number;
  initialStatus?: ValveStatus;
};

export type ReservoirBuildData = {
  id?: AssetId;
  internalId?: number;
  label?: string;
  coordinates?: Position;
  head?: number;
  relativeHead?: number;
  elevation?: number;
};

export type TankBuildData = {
  id?: AssetId;
  internalId?: number;
  label?: string;
  coordinates?: Position;
  elevation?: number;
  initialLevel?: number;
  minLevel?: number;
  maxLevel?: number;
  minVolume?: number;
  diameter?: number;
  overflow?: boolean;
};

import { UnitsSpec } from "src/model-metadata/quantities-spec";
import { IdGenerator } from "./id-generator";
import { LabelGenerator } from "./label-manager";
import {
  PumpDefintionType,
  PumpQuantity,
  PumpStatus,
} from "./asset-types/pump";
import {
  Valve,
  ValveQuantity,
  ValveStatus,
  ValveKind,
} from "./asset-types/valve";

export type DefaultQuantities = {
  pipe: Partial<Record<PipeQuantity, number>>;
  junction: Partial<Record<JunctionQuantity, number>>;
  reservoir: Partial<Record<ReservoirQuantity | "relativeHead", number>>;
  tank: Partial<Record<TankQuantity, number>>;
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
    id,
    internalId,
    label,
    coordinates = [
      [0, 0],
      [1, 1],
    ],
    connections = nullConnections,
    initialStatus = "open",
    length,
    diameter,
    minorLoss,
    roughness,
  }: PipeBuildData = {}) {
    const finalInternalId = internalId ?? this.idGenerator.newId();
    const finalStringId = id ?? String(finalInternalId);
    return new Pipe(
      finalStringId,
      finalInternalId,
      coordinates,
      {
        type: "pipe",
        label:
          label !== undefined
            ? label
            : this.labelGenerator.generateFor("pipe", finalStringId),
        connections,
        initialStatus,
        length: this.getPipeValue("length", length),
        diameter: this.getPipeValue("diameter", diameter),
        minorLoss: this.getPipeValue("minorLoss", minorLoss),
        roughness: this.getPipeValue("roughness", roughness),
      },
      this.units,
    );
  }

  buildValve({
    id,
    internalId,
    label,
    coordinates = [
      [0, 0],
      [0, 0],
    ],
    connections = nullConnections,
    diameter,
    minorLoss,
    kind = "tcv",
    setting,
    initialStatus = "active",
  }: ValveBuildData = {}) {
    const finalInternalId = internalId ?? this.idGenerator.newId();
    const finalStringId = id ?? String(finalInternalId);
    return new Valve(
      finalStringId,
      finalInternalId,
      coordinates,
      {
        type: "valve",
        label:
          label !== undefined
            ? label
            : this.labelGenerator.generateFor("valve", finalStringId),
        connections,
        length: 10,
        diameter: this.getValveValue("diameter", diameter),
        minorLoss: this.getValveValue("minorLoss", minorLoss),
        kind,
        setting: this.getValveSetting(kind, setting),
        initialStatus,
      },
      this.units,
    );
  }

  buildPump({
    id,
    internalId,
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
    const finalInternalId = internalId ?? this.idGenerator.newId();
    const finalStringId = id ?? String(finalInternalId);
    return new Pump(
      finalStringId,
      finalInternalId,
      coordinates,
      {
        type: "pump",
        label:
          label !== undefined
            ? label
            : this.labelGenerator.generateFor("pump", finalStringId),
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
    id,
    internalId,
    label,
    coordinates = [0, 0],
    elevation,
    baseDemand,
  }: JunctionBuildData = {}) {
    const finalInternalId = internalId ?? this.idGenerator.newId();
    const finalStringId = id ?? String(finalInternalId);
    return new Junction(
      finalStringId,
      finalInternalId,
      coordinates,
      {
        type: "junction",
        label:
          label !== undefined
            ? label
            : this.labelGenerator.generateFor("junction", finalStringId),
        elevation: this.getJunctionValue("elevation", elevation),
        baseDemand: this.getJunctionValue("baseDemand", baseDemand),
      },
      this.units,
    );
  }

  buildReservoir({
    id,
    internalId,
    label,
    coordinates = [0, 0],
    elevation,
    head,
    relativeHead,
  }: ReservoirBuildData = {}) {
    const finalInternalId = internalId ?? this.idGenerator.newId();
    const finalStringId = id ?? String(finalInternalId);
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
      finalStringId,
      finalInternalId,
      coordinates,
      {
        type: "reservoir",
        label:
          label !== undefined
            ? label
            : this.labelGenerator.generateFor("reservoir", finalStringId),
        head: headValue,
        elevation: elevationValue,
      },
      this.units,
    );
  }

  buildTank({
    id,
    internalId,
    label,
    coordinates = [0, 0],
    elevation,
    initialLevel,
    minLevel,
    maxLevel,
    minVolume,
    diameter,
    overflow,
  }: TankBuildData = {}) {
    const finalInternalId = internalId ?? this.idGenerator.newId();
    const finalStringId = id ?? String(finalInternalId);
    return new Tank(
      finalStringId,
      finalInternalId,
      coordinates,
      {
        type: "tank",
        label:
          label !== undefined
            ? label
            : this.labelGenerator.generateFor("tank", finalStringId),
        elevation: this.getTankValue("elevation", elevation),
        initialLevel: this.getTankValue("initialLevel", initialLevel),
        minLevel: this.getTankValue("minLevel", minLevel),
        maxLevel: this.getTankValue("maxLevel", maxLevel),
        minVolume: this.getTankValue("minVolume", minVolume),
        diameter: this.getTankValue("diameter", diameter),
        overflow: overflow ?? false,
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

  private getValveSetting(kind: ValveKind, candidate?: number) {
    if (candidate !== undefined) return candidate;

    return this.defaults.valve["tcvSetting"] || 0;
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

  private getTankValue(name: TankQuantity, candidate?: number) {
    if (candidate !== undefined) return candidate;

    return this.defaults.tank[name] || 0;
  }
}
