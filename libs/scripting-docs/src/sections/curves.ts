import { memberOf, propertyOf } from "../members";
import type { DocsCandidates, Member, Section } from "../types";

const network = memberOf("Network");
const property = propertyOf("Network");

const SECTION: Section = {
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

const ADD_CURVE: Member = network({
  name: "addCurve",
  signature: `addCurve(curve: {
  /** up to 64 bytes of Latin-1 characters, with no spaces or semicolons; unique among curves, ignoring case */
  label: string;
  type: "pump" | "efficiency" | "volume" | "valve" | "headloss";
  /** must fit the rule of the curve's type */
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

export const sectionFor = ({ edits }: DocsCandidates): Section =>
  edits
    ? { ...SECTION, members: [...(SECTION.members ?? []), ADD_CURVE] }
    : SECTION;
