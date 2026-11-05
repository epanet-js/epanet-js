import { memberOf, propertyOf } from "../members";
import type { DocsCandidates, Member, SectionDef } from "../types";

const network = memberOf("Network");
const property = propertyOf("Network");
const materialProperty = propertyOf("PipeMaterial");

const SECTION: SectionDef = {
  id: "pipe-library",
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

const SET_PIPE_MATERIAL: Member = memberOf("PipeMaterial")({
  name: "set",
  signature: `set(changes: {
  /** non-empty, with no spaces at either end; unique among materials, ignoring case */
  label?: string;
  /** roughness above 0, ages of at least 0 with none repeated, and one entry at age 0 */
  entries?: { age: number; roughness: number }[];
}): void`,
  summary: "Changes the material. What `changes` leaves out keeps its value.",
  description:
    "Takes the shape the material reads as, so a script can spread a material, change it and write it back. The material reads its new values straight away, and keeps working after a change of label. Pipes whose `material` names it, ignoring case, take the new label, and their `appliedRoughness` follows new entries. A change of label alone does not check the entries. The change reaches the network with the other changes.",
  throws: [
    "`TypeError` when the new label is not valid or another material has it, `entries` is empty, holds something other than `{ age, roughness }` numbers or breaks the rule, or `changes` has another field.",
  ],
  examples: [
    {
      code: `const material = network.getPipeMaterial("DUCTILE");
material.set({ entries: material.entries.map(({ age, roughness }) => ({ age, roughness: roughness - 10 })) });
material.set({ label: "DI" });`,
    },
  ],
});

const DELETE_PIPE_MATERIAL: Member = network({
  name: "deletePipeMaterial",
  signature: "deletePipeMaterial(label: string): void",
  summary: "Deletes a material found by its label, ignoring case.",
  description:
    "Pipes whose `material` names it keep the name, and from then on take no roughness from the library: their `appliedRoughness` is their own roughness, or `null` when they have none. Set the material or the roughness of those pipes first if they need one. Its label is free again straight away, and the material the script holds stops reading. The deletion reaches the network with the other changes.",
  throws: ["`TypeError` when no material has `label`."],
  examples: [
    {
      code: `network.getLink("P2").set({ roughness: 130 });
network.deletePipeMaterial("DUCTILE");`,
    },
  ],
});

export const sectionFor = ({ edits }: DocsCandidates): SectionDef =>
  edits
    ? {
        ...SECTION,
        members: [
          ...(SECTION.members ?? []),
          ADD_PIPE_MATERIAL,
          SET_PIPE_MATERIAL,
          DELETE_PIPE_MATERIAL,
        ],
      }
    : SECTION;
