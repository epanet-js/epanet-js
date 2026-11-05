import { memberOf, propertyOf } from "../members";
import type { DocsCandidates, Member, SectionDef } from "../types";

const network = memberOf("Network");
const property = propertyOf("Network");
const patternProperty = propertyOf("Pattern");

const SECTION: SectionDef = {
  id: "patterns",
  title: "Patterns",
  members: [
    property("patterns", "Pattern[]", "Every pattern."),
    network({
      name: "getPattern",
      signature: "getPattern(label: string): Pattern | null",
      summary: "One pattern by label, or `null`.",
    }),
    patternProperty("label", "string", "The pattern's label."),
    patternProperty(
      "type",
      '"demand" | "reservoirHead" | "pumpSpeed" | "qualitySourceStrength" | "energyPrice"',
      "What the pattern is for.",
    ),
    patternProperty(
      "multipliers",
      "number[]",
      "One multiplier per pattern timestep.",
    ),
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

const SET_PATTERN: Member = memberOf("Pattern")({
  name: "set",
  signature: `set(changes: {
  /** up to 64 bytes of Latin-1 characters, with no spaces or semicolons; unique among patterns, ignoring case */
  label?: string;
  /** only while the pattern has no type; a pattern keeps its type once it has one */
  type?: "demand" | "reservoirHead" | "pumpSpeed" | "qualitySourceStrength" | "energyPrice";
  /** one per pattern timestep */
  multipliers?: number[];
}): void`,
  summary: "Changes the pattern. What `changes` leaves out keeps its value.",
  description:
    "Takes the shape the pattern reads as, so a script can spread a pattern, change it and write it back. The pattern reads its new values straight away, and keeps working after a change of label. Everything that uses the pattern follows a new label, so `demands` and the pattern attributes of assets read it straight away. The change reaches the network with the other changes.",
  throws: [
    "`TypeError` when the new label is not a valid name or another pattern has it, `type` would change a pattern's type, `multipliers` is empty or holds something other than numbers, or `changes` has another field.",
  ],
  examples: [
    {
      code: `const pattern = network.getPattern("DAILY");
pattern.set({ multipliers: pattern.multipliers.map((m) => m * 1.1) });
pattern.set({ label: "WEEKDAY" });`,
    },
  ],
});

const DELETE_PATTERN: Member = network({
  name: "deletePattern",
  signature: "deletePattern(label: string): void",
  summary:
    "Deletes a pattern found by its label, ignoring case, when nothing uses it.",
  description:
    "A pattern is in use while a junction or customer point demand, a reservoir's head, a node's quality source, a pump's speed or energy price, or the simulation's global energy price names it. Use is judged on the network as the script has changed it so far, so take the pattern off what uses it first. Its label is free again straight away. The deletion reaches the network with the other changes.",
  throws: [
    "`TypeError` when no pattern has `label`, or the pattern is in use.",
  ],
  examples: [
    {
      title: "Delete every pattern nothing uses",
      code: `for (const { label } of network.patterns) {
  try {
    network.deletePattern(label);
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
          ADD_PATTERN,
          SET_PATTERN,
          DELETE_PATTERN,
        ],
      }
    : SECTION;
