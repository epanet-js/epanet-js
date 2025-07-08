import { Node, NodeProperties } from "./node";

export type TankProperties = {
  type: "tank";
  initialLevel: number;
  minLevel: number;
  maxLevel: number;
  minVolume: number;
  diameter: number;
} & NodeProperties;

export const tankQuantities = [
  "elevation",
  "initialLevel",
  "minLevel",
  "maxLevel",
  "minVolume",
  "diameter",
] as const;
export type TankQuantity = (typeof tankQuantities)[number];

export class Tank extends Node<TankProperties> {
  copy() {
    return new Tank(
      this.id,
      [...this.coordinates],
      {
        ...this.properties,
      },
      this.units,
    );
  }

  setSimulation() {}

  getUnit(key: TankQuantity) {
    return this.units[key];
  }

  get initialLevel() {
    return this.properties.initialLevel;
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
}
