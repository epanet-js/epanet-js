import type { AssetType } from "@epanet-js/hydraulic-model";

export type CustomAttributeAssetType = AssetType | "customerPoint";

export type CustomAttributeType = "text" | "number";

export type CustomAttributeId = string;

export type CustomAttribute = {
  id: CustomAttributeId;
  label: string;
  type: CustomAttributeType;
};

export type CustomAttributesDefinition = Map<
  CustomAttributeAssetType,
  Map<CustomAttributeId, CustomAttribute>
>;
