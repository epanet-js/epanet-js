import { AssetId, Junction, Pump } from "../asset-types";
import { Pipe, PipeStatus } from "../asset-types/pipe";
import { ChemicalSourceType } from "../asset-types/node";
import { LinkConnections, nullConnections } from "../asset-types/link";
import { Position } from "geojson";
import { Reservoir } from "../asset-types/reservoir";
import { Tank, type TankMixingModel } from "../asset-types/tank";

export type JunctionBuildData = {
  id?: AssetId;
  label?: string;
  coordinates?: Position;
  elevation?: number | null;
  emitterCoefficient?: number;
  initialQuality?: number;
  chemicalSourceType?: ChemicalSourceType;
  chemicalSourceStrength?: number;
  chemicalSourcePatternId?: PatternId;
  isActive?: boolean;
  customAttributes?: Record<string, string | number | null>;
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
  material?: string;
  year?: number;
  isActive?: boolean;
  customAttributes?: Record<string, string | number | null>;
};

export type PumpBuildData = {
  id?: AssetId;
  label?: string;
  initialStatus?: PumpStatus;
  coordinates?: Position[];
  connections?: LinkConnections;
  definitionType?: PumpDefinitionType;
  power?: number;
  curve?: CurvePoint[];
  curveId?: CurveId;
  speed?: number;
  speedPatternId?: PatternId;
  efficiencyCurveId?: CurveId;
  energyPrice?: number;
  energyPricePatternId?: PatternId;
  isActive?: boolean;
  customAttributes?: Record<string, string | number | null>;
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
  customAttributes?: Record<string, string | number | null>;
};

export type ReservoirBuildData = {
  id?: AssetId;
  label?: string;
  coordinates?: Position;
  head?: number;
  relativeHead?: number;
  elevation?: number | null;
  headPatternId?: PatternId;
  initialQuality?: number;
  chemicalSourceType?: ChemicalSourceType;
  chemicalSourceStrength?: number;
  chemicalSourcePatternId?: PatternId;
  isActive?: boolean;
  customAttributes?: Record<string, string | number | null>;
};

export type TankBuildData = {
  id?: AssetId;
  label?: string;
  coordinates?: Position;
  elevation?: number | null;
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
  customAttributes?: Record<string, string | number | null>;
};

import { IdGenerator } from "@epanet-js/id-generator";
import { LabelManager, LabelType } from "../label-manager";
import { PumpDefinitionType, PumpStatus } from "../asset-types/pump";
import { Valve, ValveStatus, ValveKind } from "../asset-types/valve";
import { CurveId, CurvePoint } from "../curves";
import { PatternId } from "../patterns";

const isProvided = (value: number | null | undefined): value is number =>
  value !== undefined && !Number.isNaN(value);

const orNull = (value?: number | null): number | null =>
  isProvided(value) ? value : null;

const orUndefined = (value?: number): number | undefined =>
  isProvided(value) ? value : undefined;

const applyCustomAttributes = <
  T extends { setProperty: (name: string, value: unknown) => void },
>(
  asset: T,
  customAttributes?: Record<string, string | number | null>,
): T => {
  for (const [id, value] of Object.entries(customAttributes ?? {})) {
    if (value !== null) asset.setProperty(id, value);
  }
  return asset;
};

export class AssetFactory {
  protected idGenerator: IdGenerator;
  private labelManager: LabelManager;

  constructor(idGenerator: IdGenerator, labelManager: LabelManager) {
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
    material,
    year,
    isActive = true,
    customAttributes,
  }: PipeBuildData = {}): Pipe {
    const internalId = id ?? this.idGenerator.newId();
    const pipe = new Pipe(internalId, coordinates, {
      type: "pipe",
      label: this.resolveLabel("pipe", internalId, label),
      connections,
      initialStatus,
      length: orNull(length),
      diameter: orNull(diameter),
      minorLoss: orUndefined(minorLoss),
      roughness: orNull(roughness),
      bulkReactionCoeff,
      wallReactionCoeff,
      material,
      year,
      isActive,
    });
    return applyCustomAttributes(pipe, customAttributes);
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
    customAttributes,
  }: ValveBuildData = {}): Valve {
    const internalId = id ?? this.idGenerator.newId();
    const valve = new Valve(internalId, coordinates, {
      type: "valve",
      label: this.resolveLabel("valve", internalId, label),
      connections,
      length: null,
      diameter: orNull(diameter),
      minorLoss: orUndefined(minorLoss),
      kind,
      setting: orNull(setting),
      initialStatus,
      isActive,
      curveId,
    });
    return applyCustomAttributes(valve, customAttributes);
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
    definitionType = "designPointCurve",
    curveId,
    curve,
    power,
    speed,
    speedPatternId,
    efficiencyCurveId,
    energyPrice,
    energyPricePatternId,
    isActive = true,
    customAttributes,
  }: PumpBuildData = {}): Pump {
    const internalId = id ?? this.idGenerator.newId();
    const pump = new Pump(internalId, coordinates, {
      type: "pump",
      label: this.resolveLabel("pump", internalId, label),
      connections,
      length: null,
      initialStatus,
      definitionType,
      power: power ?? null,
      speed,
      speedPatternId,
      curveId: curveId ?? null,
      curve: curve ?? null,
      efficiencyCurveId,
      energyPrice,
      energyPricePatternId,
      isActive,
    });
    return applyCustomAttributes(pump, customAttributes);
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
    customAttributes,
  }: JunctionBuildData = {}): Junction {
    const internalId = id ?? this.idGenerator.newId();
    const junction = new Junction(internalId, coordinates, {
      type: "junction",
      label: this.resolveLabel("junction", internalId, label),
      elevation: orNull(elevation),
      emitterCoefficient: orUndefined(emitterCoefficient),
      initialQuality: orUndefined(initialQuality),
      chemicalSourceType,
      chemicalSourceStrength,
      chemicalSourcePatternId,
      isActive,
    });
    return applyCustomAttributes(junction, customAttributes);
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
    customAttributes,
  }: ReservoirBuildData = {}): Reservoir {
    const internalId = id ?? this.idGenerator.newId();
    // Head is derived from elevation + relativeHead when provided; only when
    // neither head nor relativeHead is given does it stay empty (null).
    let headValue: number | null;
    if (isProvided(head)) {
      headValue = head;
    } else if (isProvided(relativeHead)) {
      headValue = relativeHead + (elevation ?? 0);
    } else {
      headValue = null;
    }

    const reservoir = new Reservoir(internalId, coordinates, {
      type: "reservoir",
      label: this.resolveLabel("reservoir", internalId, label),
      head: headValue,
      headPatternId,
      elevation: orNull(elevation),
      initialQuality: orUndefined(initialQuality),
      chemicalSourceType,
      chemicalSourceStrength,
      chemicalSourcePatternId,
      isActive,
    });
    return applyCustomAttributes(reservoir, customAttributes);
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
    customAttributes,
  }: TankBuildData = {}): Tank {
    const internalId = id ?? this.idGenerator.newId();
    const tank = new Tank(internalId, coordinates, {
      type: "tank",
      label: this.resolveLabel("tank", internalId, label),
      elevation: orNull(elevation),
      initialLevel: orNull(initialLevel),
      minLevel: orNull(minLevel),
      maxLevel: orNull(maxLevel),
      minVolume: orUndefined(minVolume),
      diameter: orNull(diameter),
      volumeCurveId,
      overflow: overflow ?? false,
      mixingModel: mixingModel ?? "mixed",
      mixingFraction: orUndefined(mixingFraction),
      initialQuality: orUndefined(initialQuality),
      bulkReactionCoeff,
      chemicalSourceType,
      chemicalSourceStrength,
      chemicalSourcePatternId,
      isActive,
    });
    return applyCustomAttributes(tank, customAttributes);
  }

  protected resolveLabel(type: LabelType, id: number, label?: string): string {
    if (label !== undefined) {
      this.labelManager.register(label, type, id);
      return label;
    }
    return this.labelManager.generateFor(type, id);
  }
}
