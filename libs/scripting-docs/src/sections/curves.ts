import { memberOf, propertyOf } from "../members";
import type { DocsCandidates, Member, SectionDef } from "../types";

const network = memberOf("Network");
const property = propertyOf("Network");
const curveProperty = propertyOf("Curve");

const SECTION: SectionDef = {
  id: "curves",
  title: "Curves",
  members: [
    property("curves", "Curve[]", "Every curve."),
    network({
      name: "getCurve",
      signature: "getCurve(label: string): Curve | null",
      summary: "One curve by label, or `null`.",
    }),
    curveProperty("label", "string", "The curve's label."),
    curveProperty(
      "type",
      '"pump" | "efficiency" | "volume" | "valve" | "headloss"',
      "What the curve is for.",
    ),
    curveProperty(
      "points",
      "{ x: number; y: number }[]",
      "The curve's points.",
    ),
  ],
};

const ADD_CURVE: Member = network({
  name: "addCurve",
  signature: `addCurve(curve: {
  /** up to 64 bytes of Latin-1 characters, with no spaces or semicolons; unique among curves, ignoring case */
  label: string;
  type: "pump" | "efficiency" | "volume" | "valve" | "headloss";
  /** must fit the rule of the type */
  points: { x: number; y: number }[];
}): Curve`,
  summary: "Adds a curve to the library and returns it.",
  description:
    "The points must fit the rule of the curve's type: a pump curve takes one point with x and y other than 0, or several with x rising and y falling; a volume curve at least two points with x and y both rising; a headloss or efficiency curve at least two points with x rising; a valve curve points with x and y both rising. The curve reads straight away through `curves` and `getCurve`, and its label can be given at once to anything that takes a curve of its type, such as `setVolumeCurve`. It reaches the network with the other changes.",
  throws: [
    "`TypeError` when `label` is not a valid name or another curve has it, `type` is not a curve type, `points` is empty, holds something other than `{ x, y }` numbers or breaks the rule of the type, or `curve` has another field.",
  ],
  examples: [
    {
      code: `network.addCurve({ label: "SMALL", type: "volume", points: [{ x: 0, y: 0 }, { x: 4, y: 20 }] });
network.getNode("T1").setVolumeCurve("SMALL");`,
    },
  ],
});

const SET_CURVE: Member = memberOf("Curve")({
  name: "set",
  signature: `set(changes: {
  /** up to 64 bytes of Latin-1 characters, with no spaces or semicolons; unique among curves, ignoring case */
  label?: string;
  /** only while the curve has no type; a curve keeps its type once it has one */
  type?: "pump" | "efficiency" | "volume" | "valve" | "headloss";
  /** must fit the rule of the type */
  points?: { x: number; y: number }[];
}): void`,
  summary: "Changes the curve. What `changes` leaves out keeps its value.",
  description:
    "Takes the shape the curve reads as, so a script can spread a curve, change it and write it back. The curve reads its new values straight away, and keeps working after a change of label. When `points` or `type` change, the points are checked against the rule of the curve's type, as `addCurve` describes; a curve without a type takes at least two points with x rising. A change of label alone is not checked, so a curve whose points already break its rule can still be renamed. Everything that uses the curve follows a new label. The change reaches the network with the other changes.",
  throws: [
    "`TypeError` when the new label is not a valid name or another curve has it, `type` would change a curve's type, `points` is empty, holds something other than `{ x, y }` numbers or breaks the rule of the type, or `changes` has another field.",
  ],
  examples: [
    {
      code: `const curve = network.getCurve("HEAD");
curve.set({ points: curve.points.map(({ x, y }) => ({ x, y: y * 1.1 })) });
curve.set({ label: "LIFT" });`,
    },
  ],
});

const DELETE_CURVE: Member = network({
  name: "deleteCurve",
  signature: "deleteCurve(label: string): void",
  summary:
    "Deletes a curve found by its label, ignoring case, when nothing uses it.",
  description:
    "A curve is in use while a pump takes it as its curve or efficiency curve, a tank as its volume curve, or a valve as its curve. Use is judged on the network as the script has changed it so far, so take the curve off what uses it first. Its label is free again straight away. The deletion reaches the network with the other changes.",
  throws: ["`TypeError` when no curve has `label`, or the curve is in use."],
  examples: [
    {
      title: "Delete every curve nothing uses",
      code: `for (const { label } of network.curves) {
  try {
    network.deleteCurve(label);
    console.log("deleted", label);
  } catch (error) {
    console.log("kept", label, error.message);
  }
}`,
    },
  ],
});

export const sectionFor = ({ edits }: DocsCandidates): SectionDef =>
  edits
    ? {
        ...SECTION,
        members: [
          ...(SECTION.members ?? []),
          ADD_CURVE,
          SET_CURVE,
          DELETE_CURVE,
        ],
      }
    : SECTION;
