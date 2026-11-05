import { memberOf, propertyOf } from "../members";
import type { DocsCandidates, Member, Section } from "../types";

const network = memberOf("Network");
const attributeProperty = propertyOf("CustomAttribute");

const SECTION: Section = {
  id: "custom-attributes",
  number: "1.8",
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
  signature: `addCustomAttribute(type: AssetType | "customerPoint", attribute: {
  /** up to 64 characters, with no spaces at either end; unique within the type, ignoring case */
  name: string;
  /** fixed once added */
  type: "text" | "number";
}): CustomAttribute`,
  summary: "Defines a custom attribute for a type and returns it.",
  description:
    "The attribute reads straight away through `customAttributes`, and every asset or customer point of the type can take a value for it with `setCustom` at once. Its type does not change later. Custom attributes cannot be changed while the project has scenarios, as in the app. The change reaches the network with the other changes.",
  throws: [
    '`TypeError` when the project has scenarios, `type` is not an asset type or `"customerPoint"`, `name` is not valid or another attribute of the type has it, the attribute\'s `type` is not `"text"` or `"number"`, or `attribute` has another field.',
  ],
  examples: [
    {
      code: `network.addCustomAttribute("junction", { name: "Survey year", type: "number" });
network.getNode("J1").setCustom("Survey year", 2024);`,
    },
  ],
});

export const sectionFor = ({ edits }: DocsCandidates): Section =>
  edits
    ? {
        ...SECTION,
        members: [...(SECTION.members ?? []), ADD_CUSTOM_ATTRIBUTE],
      }
    : SECTION;
