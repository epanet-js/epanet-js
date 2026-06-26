import type { AssetType } from "@epanet-js/hydraulic-model";

export type CustomAttributeAssetType = AssetType | "customerPoint";

export type CustomAttributeType = "text" | "number";

export const customAttributeTypes: CustomAttributeType[] = ["text", "number"];

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

export const emptyCustomAttributesDefinition = (): CustomAttributesDefinition =>
  new Map();

export const getAttributes = (
  definition: CustomAttributesDefinition,
  assetType: CustomAttributeAssetType,
): CustomAttribute[] => {
  const byId = definition.get(assetType);
  return byId ? [...byId.values()] : [];
};

export const countFor = (
  definition: CustomAttributesDefinition,
  assetType: CustomAttributeAssetType,
): number => definition.get(assetType)?.size ?? 0;

export const setAttributes = (
  definition: CustomAttributesDefinition,
  assetType: CustomAttributeAssetType,
  attributes: CustomAttribute[],
): CustomAttributesDefinition => {
  const next = deepCloneCustomAttributes(definition);
  const byId = new Map<CustomAttributeId, CustomAttribute>();
  for (const attribute of attributes) {
    byId.set(attribute.id, attribute);
  }
  next.set(assetType, byId);
  return next;
};

export const deepCloneCustomAttributes = (
  definition: CustomAttributesDefinition,
): CustomAttributesDefinition => {
  const next: CustomAttributesDefinition = new Map();
  for (const [assetType, byId] of definition) {
    const clonedById = new Map<CustomAttributeId, CustomAttribute>();
    for (const [id, attribute] of byId) {
      clonedById.set(id, { ...attribute });
    }
    next.set(assetType, clonedById);
  }
  return next;
};

export const totalAttributesCount = (
  definition: CustomAttributesDefinition,
): number => {
  let total = 0;
  for (const byId of definition.values()) {
    total += byId.size;
  }
  return total;
};

export const MAX_LABEL_LENGTH = 50;

export const normalizeLabel = (label: string): string =>
  label.trim().toLowerCase();

export const isLabelTooLong = (label: string): boolean =>
  label.trim().length > MAX_LABEL_LENGTH;

export const hasTooLongLabel = (attributes: CustomAttribute[]): boolean =>
  attributes.some((attribute) => isLabelTooLong(attribute.label));

export const duplicateLabelKeys = (
  attributes: CustomAttribute[],
): Set<string> => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const { label } of attributes) {
    const key = normalizeLabel(label);
    if (!key) continue;
    if (seen.has(key)) duplicates.add(key);
    else seen.add(key);
  }
  return duplicates;
};

export const hasDuplicateLabel = (attributes: CustomAttribute[]): boolean =>
  duplicateLabelKeys(attributes).size > 0;

export const nextIdSeed = (definition: CustomAttributesDefinition): number => {
  let max = 0;
  for (const byId of definition.values()) {
    for (const id of byId.keys()) {
      const digits = id.replace(/\D/g, "");
      const value = digits ? Number(digits) : 0;
      if (Number.isFinite(value)) max = Math.max(max, value);
    }
  }
  return max + 1;
};
