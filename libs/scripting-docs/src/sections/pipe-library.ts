import { memberOf, propertyOf } from "../members";
import type { DocsCandidates, Member, Section } from "../types";

const network = memberOf("Network");
const property = propertyOf("Network");
const materialProperty = propertyOf("PipeMaterial");

const SECTION: Section = {
  id: "pipe-library",
  number: "1.6",
  title: "Pipe library",
  members: [
    property("pipeMaterials", "PipeMaterial[]", "The pipe library."),
    network({
      name: "getPipeMaterial",
      signature: "getPipeMaterial(label: string): PipeMaterial | null",
      summary: "One pipe library material by label, ignoring case, or `null`.",
    }),
    materialProperty("label", "string", "The material's label."),
    materialProperty(
      "entries",
      "{ age: number; roughness: number }[]",
      "The roughness the material has from each age, in years, on.",
    ),
  ],
};

const ADD_PIPE_MATERIAL: Member = network({
  name: "addPipeMaterial",
  signature: `addPipeMaterial(material: {
  /** non-empty, with no spaces at either end; unique among materials, ignoring case */
  label: string;
  /** roughness above 0, ages of at least 0 with none repeated, and one entry at age 0 */
  entries: { age: number; roughness: number }[];
}): PipeMaterial`,
  summary: "Adds a material to the pipe library and returns it.",
  description:
    "The material reads straight away through `pipeMaterials` and `getPipeMaterial`, and pipes whose `material` names it, ignoring case, take their `appliedRoughness` from it unless they have a roughness of their own. It reaches the network with the other changes.",
  throws: [
    "`TypeError` when `label` is not valid or another material has it, `entries` is empty, holds something other than `{ age, roughness }` numbers or breaks the rule, or `material` has another field.",
  ],
  examples: [
    {
      code: `network.addPipeMaterial({ label: "PVC", entries: [{ age: 0, roughness: 150 }, { age: 20, roughness: 140 }] });
network.getLink("P3").set({ material: "PVC" });`,
    },
  ],
});

export const sectionFor = ({ edits }: DocsCandidates): Section =>
  edits
    ? { ...SECTION, members: [...(SECTION.members ?? []), ADD_PIPE_MATERIAL] }
    : SECTION;
