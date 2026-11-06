import type {
  CustomAttributeData,
  ZoneAttributePlan,
} from "@epanet-js/converters";
import {
  MAX_LABEL_LENGTH,
  buildCustomAttributeId,
  getAttributes,
  nextIdSeed,
  normalizeLabel,
  setAttributes,
  type CustomAttribute,
  type CustomAttributesDefinition,
} from "@epanet-js/hydraulic-model";

export const planZoneAttributes = (
  definition: CustomAttributesDefinition,
  declared: CustomAttributeData[],
): { definition: CustomAttributesDefinition; plan: ZoneAttributePlan } => {
  const plan: ZoneAttributePlan = new Map();
  const attributes = [...getAttributes(definition, "zone")];
  const byLabel = new Map<string, CustomAttribute>(
    attributes.map((attribute) => [normalizeLabel(attribute.label), attribute]),
  );
  let seed = nextIdSeed(definition);

  for (const { ref, name, type } of declared) {
    const label = name.trim().slice(0, MAX_LABEL_LENGTH).trim();
    if (label === "") continue;

    const existing = byLabel.get(normalizeLabel(label));
    if (existing) {
      plan.set(ref, { id: existing.id, type: existing.type });
      continue;
    }

    const attribute = { id: buildCustomAttributeId(seed++), label, type };
    attributes.push(attribute);
    byLabel.set(normalizeLabel(label), attribute);
    plan.set(ref, { id: attribute.id, type });
  }

  return { definition: setAttributes(definition, "zone", attributes), plan };
};
