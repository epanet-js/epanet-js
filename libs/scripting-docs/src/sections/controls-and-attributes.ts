import { memberOf, propertyOf } from "../members";
import type { DocsCandidates, Member, SectionDef } from "../types";

const network = memberOf("Network");
const property = propertyOf("Network");

const SECTION: SectionDef = {
  id: "controls-and-attributes",
  title: "Controls and allocation rules",
  types: [
    {
      name: "AllocationRule",
      definition:
        "interface AllocationRule { maxDistance: number; maxDiameter: number }",
      summary: "A customer point allocation rule.",
    },
  ],
  members: [
    property(
      "rawControls",
      "string[]",
      'The `[CONTROLS]` lines as INP text, e.g. `"LINK PU1 CLOSED IF NODE T1 ABOVE 5"`. Filter them as strings.',
    ),
    property("rawRules", "string[]", "The `[RULES]` blocks as INP text."),
    property(
      "defaultAllocationRules",
      "AllocationRule[]",
      "The default customer point allocation rules for the project's units.",
    ),
  ],
  notes:
    "The pumps' structured controls are on `pump.control`, not in `rawControls`. Read both before judging why a pump is off or a valve is closed.",
};

const SET_RAW_CONTROLS: Member = network({
  name: "setRawControls",
  signature: "setRawControls(controls: string[]): void",
  summary:
    "Replaces the `[CONTROLS]` lines, as saving the controls editor does. `rawRules` keeps its value.",
  description:
    "Takes the shape `rawControls` reads, so a script can filter or add lines and write the list back. Each line is read as the editor reads it: the link after the first word and the node after `IF` are matched to assets by label, ignoring case, so a line follows a later rename of its assets and goes away when one of them is deleted. A label that matches no asset is kept as written, with a console warning naming it, and the simulation fails on that line until it matches. Nothing else in a line is checked; EPANET reads it when the simulation runs. These lines act alongside the pumps' `control`, which they do not change. The change reaches the network with the other changes.",
  throws: [
    "`TypeError` when `controls` is not a list of strings, or a control is empty, spans more than one line or has spaces at either end.",
  ],
  examples: [
    {
      code: `network.setRawControls([
  ...network.rawControls.filter((line) => !line.startsWith("LINK V1 ")),
  "LINK V1 CLOSED AT TIME 12",
]);`,
    },
  ],
});

const SET_RAW_RULES: Member = network({
  name: "setRawRules",
  signature: "setRawRules(rules: string[]): void",
  summary:
    "Replaces the `[RULES]` blocks, as saving the controls editor does. `rawControls` keeps its value.",
  description:
    "Takes the shape `rawRules` reads, so a script can filter or add rules and write the list back. Each rule is one string: a `RULE <id>` line, then its clauses one per line; lines may be indented, and blank lines are dropped. The label after `LINK`, `NODE`, `TANK`, `PUMP`, `PIPE` or `VALVE` in a clause is matched to an asset, ignoring case, so a rule follows a later rename of its assets and goes away when one of them is deleted. A label that matches no asset is kept as written, with a console warning naming it, and the simulation fails on that rule until it matches. Nothing else in a rule is checked, rule ids included; EPANET reads them when the simulation runs. The change reaches the network with the other changes.",
  throws: [
    "`TypeError` when `rules` is not a list of strings, or a rule does not start with `RULE` and its id, or holds another `RULE` line.",
  ],
  examples: [
    {
      code: `network.setRawRules([
  ...network.rawRules.filter((rule) => !rule.startsWith("RULE UNRESOLVED")),
  ["RULE NIGHT", "IF SYSTEM CLOCKTIME >= 10 PM", "THEN LINK V1 STATUS IS CLOSED"].join("\\n"),
]);`,
    },
  ],
});

export const sectionFor = ({ edits }: DocsCandidates): SectionDef =>
  edits
    ? {
        ...SECTION,
        members: [...(SECTION.members ?? []), SET_RAW_CONTROLS, SET_RAW_RULES],
      }
    : SECTION;
