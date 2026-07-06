import { HydraulicModel } from "src/hydraulic-model";
import { EntityType, Rule, ValidatableEntity } from "./types";
import { RULES } from "./rules";

const fieldGroupKey = (rule: Rule): string =>
  rule.field ?? `__rule__:${rule.id}`;

export type RulesIndex = Map<EntityType, Rule[][]>;

export const indexRules = (rules: Rule[]): RulesIndex => {
  const byEntityType = new Map<EntityType, Map<string, Rule[]>>();
  for (const rule of rules) {
    const groups =
      byEntityType.get(rule.entityType) ?? new Map<string, Rule[]>();
    const key = fieldGroupKey(rule);
    const group = groups.get(key) ?? [];
    group.push(rule);
    groups.set(key, group);
    byEntityType.set(rule.entityType, groups);
  }

  const index: RulesIndex = new Map();
  for (const [entityType, groups] of byEntityType) {
    index.set(entityType, [...groups.values()]);
  }
  return index;
};

export const RULES_INDEX = indexRules(RULES);

export const fieldGroupsFor = (entityType: EntityType): Rule[][] =>
  RULES_INDEX.get(entityType) ?? [];

export const rulesFor = (entityType: EntityType, field?: string): Rule[] => {
  const groups = fieldGroupsFor(entityType);
  const flat = groups.flat();
  return field == null ? flat : flat.filter((rule) => rule.field === field);
};

export const firstFailure = (
  rules: Rule[],
  entity: ValidatableEntity,
  model: HydraulicModel,
): Rule | null => {
  for (const rule of rules) {
    const applies = rule.appliesWhen ? rule.appliesWhen(entity, model) : true;
    if (!applies) continue;
    if (!rule.check(rule.accessor(entity, model), entity)) return rule;
  }
  return null;
};

export const fieldValidator = (
  entityType: EntityType,
  field: string,
  entity?: ValidatableEntity,
): ((value: number) => boolean) | undefined => {
  const rules = rulesFor(entityType, field);
  if (rules.length === 0) return undefined;
  return (value: number) =>
    rules.every((rule) => {
      if (entity && rule.appliesWhen && !rule.appliesWhen(entity)) return true;
      return rule.check(value, entity);
    });
};
