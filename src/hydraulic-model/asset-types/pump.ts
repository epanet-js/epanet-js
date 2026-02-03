import { CurveId } from "../curves";
import { Link, LinkProperties } from "./link";
import { Unit } from "src/quantity";

export const pumpStatuses = ["on", "off"] as const;
export type PumpStatus = (typeof pumpStatuses)[number];

export type PumpStatusWarning = "cannot-deliver-flow" | "cannot-deliver-head";

export type PumpDefintionType = "power" | "design-point" | "standard";

export type PumpProperties = {
  type: "pump";
  initialStatus: PumpStatus;
  definitionType: PumpDefintionType;
  power: number;
  speed: number;
  curveId?: CurveId;
} & LinkProperties;

export const pumpQuantities = [
  "flow",
  "head",
  "designFlow",
  "designHead",
  "power",
  "speed",
];
export type PumpQuantity = (typeof pumpQuantities)[number];

export class Pump extends Link<PumpProperties> {
  getUnit(quantity: PumpQuantity): Unit {
    return this.units[quantity];
  }

  get initialStatus() {
    return this.properties.initialStatus;
  }

  get definitionType() {
    return this.properties.definitionType;
  }

  get power() {
    return this.properties.power;
  }

  get speed() {
    return this.properties.speed;
  }

  get curveId() {
    return this.properties.curveId;
  }

  copy() {
    return new Pump(
      this.id,
      [...this.coordinates],
      {
        ...this.properties,
      },
      this.units,
    );
  }
}
