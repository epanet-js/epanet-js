import { CurveId, CurvePoint, Curves, ICurve } from "../curves";
import { Link, LinkProperties } from "./link";
import { Unit } from "src/quantity";

export const pumpStatuses = ["on", "off"] as const;
export type PumpStatus = (typeof pumpStatuses)[number];

export type PumpStatusWarning = "cannot-deliver-flow" | "cannot-deliver-head";

export type PumpDefintionType = "power" | "curve" | "curveId";

export type PumpProperties = {
  type: "pump";
  initialStatus: PumpStatus;
  definitionType: PumpDefintionType;
  power: number;
  speed: number;
  curveId?: CurveId;
  curve?: CurvePoint[];
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

  get curve() {
    return this.properties.curve;
  }

  getCurve = (curves: Curves): ICurve | CurvePoint[] | undefined => {
    if (this.definitionType === "power") return undefined;
    if (this.definitionType === "curve") return this.curve;
    if (!this.curveId) return undefined;
    const curve = curves.get(this.curveId);
    return curve;
  };

  getCurvePoints = (curves: Curves): CurvePoint[] | undefined => {
    const curve = this.getCurve(curves);
    return curve ? ("id" in curve ? curve.points : curve) : undefined;
  };

  copy() {
    return new Pump(
      this.id,
      [...this.coordinates],
      {
        ...this.properties,
        curve: this.properties.curve?.map((p) => ({ ...p })),
      },
      this.units,
    );
  }
}
