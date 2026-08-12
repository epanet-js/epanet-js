import { Asset, AssetId } from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "src/hydraulic-model";
import { createTimeSlicer } from "src/infra/yield-to-main";
import {
  EntityType,
  Rule,
  Severity,
  ValidatableEntity,
  ValidationIssues,
} from "./types";
import {
  RulesIndex,
  RULES_INDEX,
  RULES_BY_ID,
  indexRules,
  firstFailure,
} from "./repository";

const failingRuleIds = (
  entityType: EntityType,
  entity: ValidatableEntity,
  model: HydraulicModel,
  index: RulesIndex,
): string[] => {
  const ruleIds: string[] = [];
  for (const group of index.get(entityType) ?? []) {
    const failed = firstFailure(group, entity, model);
    if (failed) {
      ruleIds.push(failed.id);
    }
  }
  return ruleIds;
};

const collectInto = (
  entityIdsByRule: Map<string, AssetId[]>,
  entityType: EntityType,
  entityId: AssetId,
  entity: ValidatableEntity,
  model: HydraulicModel,
  index: RulesIndex,
): void => {
  for (const ruleId of failingRuleIds(entityType, entity, model, index)) {
    const entityIds = entityIdsByRule.get(ruleId);
    if (entityIds) {
      entityIds.push(entityId);
    } else {
      entityIdsByRule.set(ruleId, [entityId]);
    }
  }
};

// Runs the attribute validation rules for a single asset. Useful for reacting
// to one asset (e.g. a freshly drawn one) without validating the whole model.
export const validateAsset = (asset: Asset, model: HydraulicModel): string[] =>
  failingRuleIds(asset.type, asset, model, RULES_INDEX);

export const countValidationIssues = (issues: ValidationIssues): number =>
  issues.reduce((total, [, entityIds]) => total + entityIds.length, 0);

const severityRank: Record<Severity, number> = { error: 0, warning: 1 };

const rankOf = (rulesById: Map<string, Rule>, ruleId: string): number => {
  const rule = rulesById.get(ruleId);
  return rule ? severityRank[rule.severity] : severityRank.warning;
};

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }
};

export const validateModelAttributes = async (
  model: HydraulicModel,
  options: { rules?: Rule[]; signal?: AbortSignal } = {},
): Promise<ValidationIssues> => {
  const { rules, signal } = options;
  throwIfAborted(signal);

  const index = rules ? indexRules(rules) : RULES_INDEX;
  const rulesById = rules
    ? new Map(rules.map((rule) => [rule.id, rule]))
    : RULES_BY_ID;
  const entityIdsByRule = new Map<string, AssetId[]>();
  const yieldIfSliceElapsed = createTimeSlicer();

  for (const [id, asset] of model.assets) {
    await yieldIfSliceElapsed();
    throwIfAborted(signal);
    collectInto(entityIdsByRule, asset.type, id, asset, model, index);
  }

  for (const [id, customerPoint] of model.customerPoints) {
    await yieldIfSliceElapsed();
    throwIfAborted(signal);
    collectInto(
      entityIdsByRule,
      "customerPoint",
      id,
      customerPoint,
      model,
      index,
    );
  }

  return [...entityIdsByRule].sort(
    ([a], [b]) => rankOf(rulesById, a) - rankOf(rulesById, b),
  );
};
