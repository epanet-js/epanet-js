import { Link, LinkProperties } from "./link";
import { Unit } from "src/quantity";

export const valveStatuses = ["active", "open", "closed"] as const;
export type ValveStatus = (typeof valveStatuses)[number];
export type ValveStatusWarning =
  | "cannot-deliver-flow"
  | "cannot-deliver-pressure";

export const valveKinds = ["prv", "psv", "fcv", "pbv", "tcv"] as const;
export const controlKinds = ["prv", "psv", "fcv", "pbv"];
export type ValveKind = (typeof valveKinds)[number];

export type ValveProperties = {
  type: "valve";
  diameter: number;
  minorLoss: number;
  kind: ValveKind;
  setting: number;
  initialStatus: ValveStatus;
} & LinkProperties;

export const valveQuantities = ["diameter", "minorLoss", "setting"];
export type ValveQuantity = (typeof valveQuantities)[number];

export class Valve extends Link<ValveProperties> {
  getUnit(quantity: ValveQuantity): Unit {
    return this.units[quantity];
  }

  get diameter() {
    return this.properties.diameter;
  }

  get minorLoss() {
    return this.properties.minorLoss;
  }

  get kind() {
    return this.properties.kind;
  }

  get setting() {
    return this.properties.setting;
  }

  get initialStatus() {
    return this.properties.initialStatus;
  }

  copy() {
    return new Valve(
      this.id,
      [...this.coordinates],
      {
        ...this.properties,
      },
      this.units,
    );
  }
}
