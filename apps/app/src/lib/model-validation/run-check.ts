import { HydraulicModel } from "src/hydraulic-model";
import { createTimeSlicer } from "src/infra/yield-to-main";
import { EntityType, Rule, ValidatableEntity, ValidationIssue } from "./types";
import { RULES } from "./rules";

const fieldGroupKey = (rule: Rule): string =>
  rule.field ?? `__rule__:${rule.id}`;

const groupRulesByField = (rules: Rule[]): Rule[][] => {
  const groups = new Map<string, Rule[]>();
  for (const rule of rules) {
    const key = fieldGroupKey(rule);
    const group = groups.get(key);
    if (group) group.push(rule);
    else groups.set(key, [rule]);
  }
  return [...groups.values()];
};

const buildFieldGroupsByEntityType = (
  rules: Rule[],
): Map<EntityType, Rule[][]> => {
  const rulesByEntityType = new Map<EntityType, Rule[]>();
  for (const rule of rules) {
    const entityRules = rulesByEntityType.get(rule.entityType);
    if (entityRules) entityRules.push(rule);
    else rulesByEntityType.set(rule.entityType, [rule]);
  }

  const grouped = new Map<EntityType, Rule[][]>();
  for (const [entityType, entityRules] of rulesByEntityType) {
    grouped.set(entityType, groupRulesByField(entityRules));
  }
  return grouped;
};

const validateEntity = (
  entityType: EntityType,
  entityId: number,
  entity: ValidatableEntity,
  model: HydraulicModel,
  fieldGroupsByEntityType: Map<EntityType, Rule[][]>,
): ValidationIssue[] => {
  const fieldGroups = fieldGroupsByEntityType.get(entityType);
  if (!fieldGroups) return [];

  const issues: ValidationIssue[] = [];
  for (const group of fieldGroups) {
    for (const rule of group) {
      const value = rule.accessor(entity, model);
      if (!rule.validate(value, entity, model)) {
        issues.push({
          ruleId: rule.id,
          entityType,
          entityId,
          label: entity.label ?? null,
          field: rule.field ?? null,
          severity: rule.severity,
          message: rule.message,
        });
        break;
      }
    }
  }
  return issues;
};

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }
};

export const validateModel = async (
  model: HydraulicModel,
  options: { rules?: Rule[]; signal?: AbortSignal } = {},
): Promise<ValidationIssue[]> => {
  const { rules = RULES, signal } = options;
  throwIfAborted(signal);

  const fieldGroupsByEntityType = buildFieldGroupsByEntityType(rules);
  const issues: ValidationIssue[] = [];
  const yieldIfSliceElapsed = createTimeSlicer();

  for (const [id, asset] of model.assets) {
    await yieldIfSliceElapsed();
    throwIfAborted(signal);
    issues.push(
      ...validateEntity(asset.type, id, asset, model, fieldGroupsByEntityType),
    );
  }

  for (const [id, customerPoint] of model.customerPoints) {
    await yieldIfSliceElapsed();
    throwIfAborted(signal);
    issues.push(
      ...validateEntity(
        "customerPoint",
        id,
        customerPoint,
        model,
        fieldGroupsByEntityType,
      ),
    );
  }

  return issues;
};
