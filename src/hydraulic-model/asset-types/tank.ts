import { CurveId, Curves, ICurve } from "../curves";
import { Node, NodeProperties } from "./node";

export const tankMixingModels = ["mixed", "2comp", "fifo", "lifo"] as const;
export type TankMixingModel = (typeof tankMixingModels)[number];

export type TankProperties = {
  type: "tank";
  initialLevel: number;
  minLevel: number;
  maxLevel: number;
  minVolume: number;
  diameter: number;
  overflow: boolean;
  mixingModel: TankMixingModel;
  mixingFraction: number;
  bulkReactionCoeff?: number;
  volumeCurveId?: CurveId;
} & NodeProperties;

export const tankQuantities = [
  "elevation",
  "initialLevel",
  "minLevel",
  "maxLevel",
  "minVolume",
  "diameter",
  "initialWaterAge",
  "pressure",
  "head",
  "level",
  "volume",
] as const;
export type TankQuantity = (typeof tankQuantities)[number];

export class Tank extends Node<TankProperties> {
  copy() {
    return new Tank(this.id, [...this.coordinates], {
      ...this.properties,
    });
  }

  get initialLevel() {
    return this.properties.initialLevel;
  }

  get initialWaterAge() {
    return this.properties.initialWaterAge;
  }

  get bulkReactionCoeff() {
    return this.properties.bulkReactionCoeff;
  }

  get minLevel() {
    return this.properties.minLevel;
  }

  get maxLevel() {
    return this.properties.maxLevel;
  }

  get minVolume() {
    return this.properties.minVolume;
  }

  get diameter() {
    return this.properties.diameter;
  }

  get overflow() {
    return this.properties.overflow;
  }

  get mixingModel() {
    return this.properties.mixingModel;
  }

  get mixingFraction() {
    return this.properties.mixingFraction;
  }

  get volumeCurveId() {
    return this.properties.volumeCurveId;
  }

  get area() {
    return tankAreaFromDiameter(this.diameter);
  }

  get maxVolume() {
    return tankVolumeFor(
      this.diameter,
      this.maxLevel,
      this.minVolume,
      this.minLevel,
    );
  }
}

export const getTankCurveVolumeRange = (
  volumeCurveId: CurveId | undefined,
  curves: Curves,
): { min: number; max: number } | undefined => {
  if (!volumeCurveId) return;
  const curve = curves.get(volumeCurveId);
  if (!curve || curve.points.length === 0) return;
  return {
    min: curve.points[0].y,
    max: curve.points[curve.points.length - 1].y,
  };
};

export const tankVolumeFor = (
  diameter: number,
  maxLevel: number,
  minVolume: number = 0,
  minLevel: number = 0,
): number => {
  const area = tankAreaFromDiameter(diameter);
  const vMin = minVolume > 0 ? minVolume : area * minLevel;
  return vMin + area * (maxLevel - minLevel);
};

export const tankDiameterFor = (
  maxVolume: number,
  maxLevel: number,
  minVolume: number = 0,
  minLevel: number = 0,
): number => {
  const area =
    minVolume > 0
      ? (maxVolume - minVolume) / (maxLevel - minLevel)
      : maxVolume / maxLevel;
  return tankDiameterFromArea(area);
};

export const tankAreaFromDiameter = (diameter: number): number => {
  return Math.PI * (diameter / 2) ** 2;
};

export const tankDiameterFromArea = (area: number): number => {
  return 2 * Math.sqrt(area / Math.PI);
};

export const tankVolumeCurveRange = (curve: ICurve) => ({
  minLevel: curve.points[0].x,
  maxLevel: curve.points[curve.points.length - 1].x,
  minVolume: curve.points[0].y,
  maxVolume: curve.points[curve.points.length - 1].y,
});

export const tankMaxVolume = (tank: Tank, curves: Curves) => {
  if (tank.volumeCurveId && curves.has(tank.volumeCurveId)) {
    return tankVolumeCurveRange(curves.get(tank.volumeCurveId)!).maxVolume;
  }
  return tank.maxVolume;
};
