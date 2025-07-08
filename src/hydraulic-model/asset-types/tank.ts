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
  "pressure",
  "head",
  "level",
  "volume",
] as const;
export type TankQuantity = (typeof tankQuantities)[number];

export type TankSimulation = {
  pressure: number;
  head: number;
  level: number;
  volume: number;
};

export class Tank extends Node<TankProperties> {
  private simulation: TankSimulation | null = null;

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

  setSimulation(simulation: TankSimulation | null) {
    this.simulation = simulation;
  }

  get pressure() {
    if (!this.simulation) return null;
    return this.simulation.pressure;
  }

  get head() {
    if (!this.simulation) return null;
    return this.simulation.head;
  }

  get level() {
    if (!this.simulation) return null;
    return this.simulation.level;
  }

  get volume() {
    if (!this.simulation) return null;
    return this.simulation.volume;
  }

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
