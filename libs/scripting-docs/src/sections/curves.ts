import { memberOf, propertyOf } from "../members";
import type { Section } from "../types";

const network = memberOf("Network");
const property = propertyOf("Network");

export const SECTION: Section = {
  id: "curves",
  number: "1.5",
  title: "Curves",
  types: [
    {
      name: "Curve",
      definition: `interface Curve {
  label: string;
  type: "pump" | "efficiency" | "volume" | "valve" | "headloss";
  points: { x: number; y: number }[];
}`,
      summary: "A shared curve.",
    },
  ],
  members: [
    property("curves", "Curve[]", "Every curve."),
    network({
      name: "getCurve",
      signature: "getCurve(label: string): Curve | null",
      summary: "One curve by label, or `null`.",
    }),
  ],
};
