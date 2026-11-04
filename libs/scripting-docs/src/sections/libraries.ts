import { memberOf, propertyOf } from "../members";
import type { DocsCandidates, Member, Section } from "../types";

const network = memberOf("Network");
const property = propertyOf("Network");

export const SECTION: Section = {
  id: "libraries",
  number: "1.4",
  title: "Libraries, controls and attributes",
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
    {
      name: "Curve",
      definition: `interface Curve {
  label: string;
  type: "pump" | "efficiency" | "volume" | "valve" | "headloss";
  points: { x: number; y: number }[];
}`,
      summary: "A shared curve.",
    },
    {
      name: "PipeMaterial",
      definition:
        "interface PipeMaterial { label: string; entries: { age: number; roughness: number }[] }",
      summary: "A pipe library material: the roughness it has at each age.",
    },
    {
      name: "CustomAttribute",
      definition:
        'interface CustomAttribute { name: string; type: "text" | "number" }',
      summary: "A custom attribute defined for an asset type.",
    },
    {
      name: "AllocationRule",
      definition:
        "interface AllocationRule { maxDistance: number; maxDiameter: number }",
      summary: "A customer point allocation rule.",
    },
  ],
  members: [
    property("patterns", "Pattern[]", "Every pattern."),
    network({
      name: "getPattern",
      signature: "getPattern(label: string): Pattern | null",
      summary: "One pattern by label, or `null`.",
    }),
    property("curves", "Curve[]", "Every curve."),
    network({
      name: "getCurve",
      signature: "getCurve(label: string): Curve | null",
      summary: "One curve by label, or `null`.",
    }),
    property("pipeMaterials", "PipeMaterial[]", "The pipe library."),
    property(
      "rawControls",
      "string[]",
      'The `[CONTROLS]` lines as INP text, e.g. `"LINK PU1 CLOSED IF NODE T1 ABOVE 5"`. Filter them as strings.',
    ),
    property("rawRules", "string[]", "The `[RULES]` blocks as INP text."),
    network({
      name: "customAttributes",
      signature:
        'customAttributes(type: AssetType | "customerPoint"): CustomAttribute[]',
      summary: "The custom attributes defined for a type.",
      description: "Read a value with `asset.getCustom(name)`.",
      throws: [
        "`network.customAttributes expects one of junction, reservoir, tank, pipe, pump, valve, customerPoint`",
      ],
    }),
    property(
      "defaultAllocationRules",
      "AllocationRule[]",
      "The default customer point allocation rules for the project's units.",
    ),
  ],
  notes:
    "The pumps' structured controls are on `pump.control`, not in `rawControls`. Read both before judging why a pump is off or a valve is closed.",
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
    ? {
        ...SECTION,
        members: (SECTION.members ?? []).flatMap((member) =>
          member.name === "getPattern" ? [member, ADD_PATTERN] : [member],
        ),
      }
    : SECTION;
