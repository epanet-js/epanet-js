import { memberOf, propertyOf } from "../members";
import type { DocsCandidates, Member, Section } from "../types";

const network = memberOf("Network");
const property = propertyOf("Network");

const SECTION: Section = {
  id: "patterns",
  number: "1.4",
  title: "Patterns",
  types: [
    {
      name: "Pattern",
      definition: `interface Pattern {
  label: string;
  type: "demand" | "reservoirHead" | "pumpSpeed" | "qualitySourceStrength" | "energyPrice";
  multipliers: number[];
}`,
      summary: "A time pattern.",
    },
  ],
  members: [
    property("patterns", "Pattern[]", "Every pattern."),
    network({
      name: "getPattern",
      signature: "getPattern(label: string): Pattern | null",
      summary: "One pattern by label, or `null`.",
    }),
  ],
};

const ADD_PATTERN: Member = network({
  name: "addPattern",
  signature: `addPattern(pattern: {
  /** up to 64 bytes of Latin-1 characters, with no spaces or semicolons; unique among patterns, ignoring case */
  label: string;
  type: "demand" | "reservoirHead" | "pumpSpeed" | "qualitySourceStrength" | "energyPrice";
  /** one per pattern timestep */
  multipliers: number[];
}): Pattern`,
  summary: "Adds a pattern to the library and returns it.",
  description:
    "The pattern reads straight away through `patterns` and `getPattern`, and its label can be given at once to anything that takes a pattern of its type, such as `setDemands`. It reaches the network with the other changes.",
  throws: [
    "`TypeError` when `label` is not a valid name or another pattern has it, `type` is not a pattern type, `multipliers` is empty or holds something other than numbers, or `pattern` has another field.",
  ],
  examples: [
    {
      code: `network.addPattern({ label: "NIGHT", type: "demand", multipliers: [0.6, 0.4, 0.4, 0.8] });
network.getNode("J1").setDemands([{ base: 2, pattern: "NIGHT" }]);`,
    },
  ],
});

export const sectionFor = ({ edits }: DocsCandidates): Section =>
  edits
    ? { ...SECTION, members: [...(SECTION.members ?? []), ADD_PATTERN] }
    : SECTION;
