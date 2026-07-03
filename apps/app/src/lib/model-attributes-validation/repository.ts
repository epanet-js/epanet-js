import { HydraulicModel } from "src/hydraulic-model";
import { EntityType, Rule, ValidatableEntity } from "./types";
import { RULES } from "./rules";

// Index RULES by entity type (and, within a type, by field) once, preserving the
// declared order so callers get the rules to run in the correct sequence.
const fieldGroupKey = (rule: Rule): string =>
  rule.field ?? `__rule__:${rule.id}`;

export type RulesIndex = Map<EntityType, Rule[][]>;

// Group rules by entity type, then by field, preserving declared order so the
// rules come back in the correct sequence.
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

// Rules grouped by field, in order — the pre-simulation runner iterates these
// and fails fast within each group.
export const fieldGroupsFor = (entityType: EntityType): Rule[][] =>
  RULES_INDEX.get(entityType) ?? [];

// The rules for an entity type, optionally narrowed to one field, in order.
export const rulesFor = (entityType: EntityType, field?: string): Rule[] => {
  const groups = fieldGroupsFor(entityType);
  const flat = groups.flat();
  return field == null ? flat : flat.filter((rule) => rule.field === field);
};

// Run rules in order against an entity, respecting applicability, and return the
// first failing rule (or null). Shared by the pre-simulation check.
export const firstFailure = (
  rules: Rule[],
  entity: ValidatableEntity,
  model: HydraulicModel,
): Rule | null => {
  for (const rule of rules) {
    const applies = rule.appliesWhen ? rule.appliesWhen(entity, model) : true;
    if (!applies) continue;
    if (!rule.check(rule.accessor(entity, model))) return rule;
  }
  return null;
};

export const fieldValidator = (
  entityType: EntityType,
  field: string,
): ((value: number) => boolean) | undefined => {
  const rules = rulesFor(entityType, field);
  if (rules.length === 0) return undefined;
  return (value: number) => rules.every((rule) => rule.check(value));
};
