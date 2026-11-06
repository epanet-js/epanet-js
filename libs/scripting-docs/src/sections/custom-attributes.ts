import { memberOf, propertyOf } from "../members";
import type { DocsCandidates, Member, SectionDef } from "../types";

const network = memberOf("Network");
const attributeProperty = propertyOf("CustomAttribute");

const SECTION: SectionDef = {
  id: "custom-attributes",
  title: "Custom attributes",
  members: [
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
    attributeProperty(
      "name",
      "string",
      "The attribute's name, unique within its type, ignoring case.",
    ),
    attributeProperty(
      "type",
      '"text" | "number"',
      "What values of the attribute hold.",
    ),
  ],
};

const ADD_CUSTOM_ATTRIBUTE: Member = network({
  name: "addCustomAttribute",
  signature: `addCustomAttribute(type: AssetType | "customerPoint" | "zone", attribute: {
  /** up to 64 characters, with no spaces at either end; unique within the type, ignoring case */
  name: string;
  /** fixed once added */
  type: "text" | "number";
}): CustomAttribute`,
  summary: "Defines a custom attribute for a type and returns it.",
  description:
    "The attribute reads straight away through `customAttributes`, and every asset, customer point or zone of the type can take a value for it with `setCustom` at once. Its type does not change later. Custom attributes cannot be changed while the project has scenarios, as in the app. The change reaches the network with the other changes.",
  throws: [
    '`TypeError` when the project has scenarios, `type` is not an asset type, `"customerPoint"` or `"zone"`, `name` is not valid or another attribute of the type has it, the attribute\'s `type` is not `"text"` or `"number"`, or `attribute` has another field.',
  ],
  examples: [
    {
      code: `network.addCustomAttribute("junction", { name: "Survey year", type: "number" });
network.getNode("J1").setCustom("Survey year", 2024);`,
    },
  ],
});

const SET_CUSTOM_ATTRIBUTE: Member = memberOf("CustomAttribute")({
  name: "set",
  signature: `set(changes: {
  /** up to 64 characters, with no spaces at either end; unique within the type, ignoring case */
  name?: string;
  /** only the type the attribute has; a custom attribute keeps its type */
  type?: "text" | "number";
}): void`,
  summary:
    "Renames the custom attribute. What `changes` leaves out keeps its value.",
  description:
    "Takes the shape the attribute reads as, so a script can spread an attribute, change its name and write it back. The attribute reads its new name straight away and keeps working. Every value follows the new name: `getCustom` and `setCustom` take it at once, and the old name reads `null`. Custom attributes cannot be changed while the project has scenarios, as in the app. The change reaches the network with the other changes.",
  throws: [
    "`TypeError` when the project has scenarios, the new name is not valid or another attribute of the type has it, `type` is not the attribute's type, or `changes` has another field.",
  ],
  examples: [
    {
      code: `const zone = network.customAttributes("junction").find((attribute) => attribute.name === "Zone");
zone.set({ name: "District" });
console.log(network.getNode("J1").getCustom("District"));`,
    },
  ],
});

const DELETE_CUSTOM_ATTRIBUTE: Member = network({
  name: "deleteCustomAttribute",
  signature:
    'deleteCustomAttribute(type: AssetType | "customerPoint", name: string): void',
  summary:
    "Deletes a custom attribute of a type, found by its name ignoring case, with every value it holds.",
  description:
    "Every asset, customer point or zone of the type loses its value for the attribute, as when the attribute is deleted in the app. Its name is free again straight away, and the attribute the script holds stops reading. Custom attributes cannot be changed while the project has scenarios. The deletion reaches the network with the other changes.",
  throws: [
    '`TypeError` when the project has scenarios, `type` is not an asset type or `"customerPoint"`, or no attribute of the type has `name`.',
  ],
  examples: [
    {
      code: `network.deleteCustomAttribute("pipe", "Class");`,
    },
  ],
});

const CUSTOM_ATTRIBUTES_WITH_ZONES: Member = network({
  name: "customAttributes",
  signature:
    'customAttributes(type: AssetType | "customerPoint" | "zone"): CustomAttribute[]',
  summary: "The custom attributes defined for a type.",
  description: "Read a value with `asset.getCustom(name)`.",
  throws: [
    "`network.customAttributes expects one of junction, reservoir, tank, pipe, pump, valve, customerPoint, zone`",
  ],
});

export const sectionFor = ({ edits }: DocsCandidates): SectionDef =>
  edits
    ? {
        ...SECTION,
        members: [
          CUSTOM_ATTRIBUTES_WITH_ZONES,
          ...(SECTION.members ?? []).slice(1),
          ADD_CUSTOM_ATTRIBUTE,
          SET_CUSTOM_ATTRIBUTE,
          DELETE_CUSTOM_ATTRIBUTE,
        ],
      }
    : SECTION;
