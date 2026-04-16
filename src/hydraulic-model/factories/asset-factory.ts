import { AssetId, Junction, Pump } from "../asset-types";
import { JunctionQuantity } from "../asset-types/junction";
import { Pipe, PipeQuantity, PipeStatus } from "../asset-types/pipe";
import { ChemicalSourceType } from "../asset-types/node";
import { LinkConnections, nullConnections } from "../asset-types/link";
import { Position } from "geojson";
import { Reservoir, ReservoirQuantity } from "../asset-types/reservoir";
import { Tank, TankQuantity, type TankMixingModel } from "../asset-types/tank";

export type JunctionBuildData = {
  id?: AssetId;
  label?: string;
  coordinates?: Position;
  elevation?: number;
  emitterCoefficient?: number;
  initialQuality?: number;
  chemicalSourceType?: ChemicalSourceType;
  chemicalSourceStrength?: number;
  chemicalSourcePatternId?: PatternId;
  isActive?: boolean;
};

export type PipeBuildData = {
  id?: AssetId;
  label?: string;
  coordinates?: Position[];
  connections?: LinkConnections;
  initialStatus?: PipeStatus;
  diameter?: number;
  roughness?: number;
  minorLoss?: number;
  length?: number;
  bulkReactionCoeff?: number;
  wallReactionCoeff?: number;
  isActive?: boolean;
};

export type PumpBuildData = {
  id?: AssetId;
  label?: string;
  initialStatus?: PumpStatus;
  coordinates?: Position[];
  connections?: LinkConnections;
  definitionType?: PumpDefintionType;
  power?: number;
  curve?: CurvePoint[];
  curveId?: CurveId;
  speed?: number;
  speedPatternId?: PatternId;
  efficiencyCurveId?: CurveId;
  energyPrice?: number;
  energyPricePatternId?: PatternId;
  isActive?: boolean;
};

export type ValveBuildData = {
  id?: AssetId;
  label?: string;
  diameter?: number;
  minorLoss?: number;
  coordinates?: Position[];
  connections?: LinkConnections;
  kind?: ValveKind;
  setting?: number;
  initialStatus?: ValveStatus;
  isActive?: boolean;
  curveId?: CurveId;
};

export type ReservoirBuildData = {
  id?: AssetId;
  label?: string;
  coordinates?: Position;
  head?: number;
  relativeHead?: number;
  elevation?: number;
  headPatternId?: PatternId;
  initialQuality?: number;
  chemicalSourceType?: ChemicalSourceType;
  chemicalSourceStrength?: number;
  chemicalSourcePatternId?: PatternId;
  isActive?: boolean;
};

export type TankBuildData = {
  id?: AssetId;
  label?: string;
  coordinates?: Position;
  elevation?: number;
  initialLevel?: number;
  minLevel?: number;
  maxLevel?: number;
  minVolume?: number;
  diameter?: number;
  overflow?: boolean;
  mixingModel?: TankMixingModel;
  mixingFraction?: number;
  initialQuality?: number;
  bulkReactionCoeff?: number;
  chemicalSourceType?: ChemicalSourceType;
  chemicalSourceStrength?: number;
  chemicalSourcePatternId?: PatternId;
  isActive?: boolean;
  volumeCurveId?: CurveId;
};

import { IdGenerator } from "src/lib/id-generator";
import { LabelManager, LabelType } from "../label-manager";
import { DefaultsSpec } from "src/lib/project-settings/quantities-spec";
import {
  PumpDefintionType,
  PumpQuantity,
  PumpStatus,
} from "../asset-types/pump";
import {
  Valve,
  ValveQuantity,
  ValveStatus,
  ValveKind,
} from "../asset-types/valve";
import { CurveId, CurvePoint, defaultCurvePoints } from "../curves";
import { PatternId } from "../patterns";

export class AssetFactory {
  private defaults: DefaultsSpec;
  private idGenerator: IdGenerator;
  private labelManager: LabelManager;

  constructor(
    defaults: DefaultsSpec,
    idGenerator: IdGenerator,
    labelManager: LabelManager,
  ) {
    this.defaults = defaults;
    this.idGenerator = idGenerator;
    this.labelManager = labelManager;
  }

  createPipe({
    id,
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
    bulkReactionCoeff,
    wallReactionCoeff,
    isActive = true,
  }: PipeBuildData = {}) {
    const internalId = id ?? this.idGenerator.newId();
    return new Pipe(internalId, coordinates, {
      type: "pipe",
      label: this.resolveLabel("pipe", internalId, label),
      connections,
      initialStatus,
      length: this.getPipeValue("length", length),
      diameter: this.getPipeValue("diameter", diameter),
      minorLoss: this.getPipeValue("minorLoss", minorLoss),
      roughness: this.getPipeValue("roughness", roughness),
      bulkReactionCoeff,
      wallReactionCoeff,
      isActive,
    });
  }

  createValve({
    id,
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
    isActive = true,
    curveId,
  }: ValveBuildData = {}) {
    const internalId = id ?? this.idGenerator.newId();
    return new Valve(internalId, coordinates, {
      type: "valve",
      label: this.resolveLabel("valve", internalId, label),
      connections,
      length: 10,
      diameter: this.getValveValue("diameter", diameter),
      minorLoss: this.getValveValue("minorLoss", minorLoss),
      kind,
      setting: this.getValveSetting(kind, setting),
      initialStatus,
      isActive,
      curveId,
    });
  }

  createPump({
    id,
    label,
    coordinates = [
      [0, 0],
      [0, 0],
    ],
    initialStatus = "on",
    connections = nullConnections,
    definitionType = "curve",
    curveId,
    curve,
    power,
    speed = 1,
    speedPatternId,
    efficiencyCurveId,
    energyPrice,
    energyPricePatternId,
    isActive = true,
  }: PumpBuildData = {}) {
    const internalId = id ?? this.idGenerator.newId();
    return new Pump(internalId, coordinates, {
      type: "pump",
      label: this.resolveLabel("pump", internalId, label),
      connections,
      length: 10,
      initialStatus,
      definitionType,
      power: this.getPumpValue("power", power),
      speed,
      speedPatternId,
      curveId,
      curve: curve
        ? curve
        : definitionType === "curve"
          ? defaultCurvePoints("pump")
          : undefined,
      efficiencyCurveId,
      energyPrice,
      energyPricePatternId,
      isActive,
    });
  }

  createJunction({
    id,
    label,
    coordinates = [0, 0],
    elevation,
    emitterCoefficient,
    initialQuality,
    chemicalSourceType,
    chemicalSourceStrength,
    chemicalSourcePatternId,
    isActive = true,
  }: JunctionBuildData = {}) {
    const internalId = id ?? this.idGenerator.newId();
    return new Junction(internalId, coordinates, {
      type: "junction",
      label: this.resolveLabel("junction", internalId, label),
      elevation: this.getJunctionValue("elevation", elevation),
      emitterCoefficient: emitterCoefficient ?? 0,
      initialQuality: initialQuality ?? 0,
      chemicalSourceType,
      chemicalSourceStrength,
      chemicalSourcePatternId,
      isActive,
    });
  }

  createReservoir({
    id,
    label,
    coordinates = [0, 0],
    elevation,
    head,
    relativeHead,
    headPatternId,
    initialQuality,
    chemicalSourceType,
    chemicalSourceStrength,
    chemicalSourcePatternId,
    isActive = true,
  }: ReservoirBuildData = {}) {
    const internalId = id ?? this.idGenerator.newId();
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

    return new Reservoir(internalId, coordinates, {
      type: "reservoir",
      label: this.resolveLabel("reservoir", internalId, label),
      head: headValue,
      headPatternId,
      elevation: elevationValue,
      initialQuality: initialQuality ?? 0,
      chemicalSourceType,
      chemicalSourceStrength,
      chemicalSourcePatternId,
      isActive,
    });
  }

  createTank({
    id,
    label,
    coordinates = [0, 0],
    elevation,
    initialLevel,
    minLevel,
    maxLevel,
    minVolume,
    diameter,
    overflow,
    mixingModel,
    mixingFraction,
    initialQuality,
    bulkReactionCoeff,
    chemicalSourceType,
    chemicalSourceStrength,
    chemicalSourcePatternId,
    isActive = true,
    volumeCurveId,
  }: TankBuildData = {}) {
    const internalId = id ?? this.idGenerator.newId();
    return new Tank(internalId, coordinates, {
      type: "tank",
      label: this.resolveLabel("tank", internalId, label),
      elevation: this.getTankValue("elevation", elevation),
      initialLevel: this.getTankValue("initialLevel", initialLevel),
      minLevel: this.getTankValue("minLevel", minLevel),
      maxLevel: this.getTankValue("maxLevel", maxLevel),
      minVolume: this.getTankValue("minVolume", minVolume),
      diameter: this.getTankValue("diameter", diameter),
      volumeCurveId,
      overflow: overflow ?? false,
      mixingModel: mixingModel ?? "mixed",
      mixingFraction: mixingFraction ?? 1.0,
      initialQuality: initialQuality ?? 0,
      bulkReactionCoeff,
      chemicalSourceType,
      chemicalSourceStrength,
      chemicalSourcePatternId,
      isActive,
    });
  }

  private resolveLabel(type: LabelType, id: number, label?: string): string {
    if (label !== undefined) {
      this.labelManager.register(label, type, id);
      return label;
    }
    return this.labelManager.generateFor(type, id);
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
