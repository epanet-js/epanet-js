import { CurveId } from "../curves";
import { Link, LinkProperties } from "./link";

export const valveStatuses = ["active", "open", "closed"] as const;
export type ValveStatus = (typeof valveStatuses)[number];
export type ValveStatusWarning =
  | "cannot-deliver-flow"
  | "cannot-deliver-pressure";

export const valveKinds = [
  "prv",
  "psv",
  "fcv",
  "pbv",
  "tcv",
  "gpv",
  "pcv",
] as const;
export const selectableValveKinds = [
  "prv",
  "psv",
  "fcv",
  "pbv",
  "tcv",
] as const;
export const controlKinds = ["prv", "psv", "fcv", "pbv", "gpv"];
export type ValveKind = (typeof valveKinds)[number];

export type ValveProperties = {
  type: "valve";
  diameter: number;
  minorLoss: number;
  kind: ValveKind;
  setting: number;
  initialStatus: ValveStatus;
  curveId?: CurveId;
} & LinkProperties;

export const valveQuantities = ["diameter", "minorLoss", "setting"];
export type ValveQuantity = (typeof valveQuantities)[number];

export class Valve extends Link<ValveProperties> {
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

  get curveId() {
    return this.properties.curveId;
  }

  copy() {
    return new Valve(this.id, [...this.coordinates], {
      ...this.properties,
    });
  }
}

export const valveCurveTypeFrom = (
  valveKind: ValveKind,
): "headloss" | "valve" | undefined => {
  if (valveKind === "gpv") return "headloss";
  if (valveKind === "pcv") return "valve";
  return;
};
