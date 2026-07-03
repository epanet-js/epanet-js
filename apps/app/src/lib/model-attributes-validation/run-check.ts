import { HydraulicModel } from "src/hydraulic-model";
import { createTimeSlicer } from "src/infra/yield-to-main";
import { EntityType, Rule, ValidatableEntity, ValidationIssue } from "./types";
import {
  RulesIndex,
  RULES_INDEX,
  indexRules,
  firstFailure,
} from "./repository";

const validateEntity = (
  entityType: EntityType,
  entityId: number,
  entity: ValidatableEntity,
  model: HydraulicModel,
  index: RulesIndex,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  for (const group of index.get(entityType) ?? []) {
    const failed = firstFailure(group, entity, model);
    if (failed) {
      issues.push({
        ruleId: failed.id,
        entityType,
        entityId,
        label: entity.label ?? null,
        field: failed.field ?? null,
        severity: failed.severity,
        message: failed.message,
      });
    }
  }
  return issues;
};

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }
};

export const validateModelAttributes = async (
  model: HydraulicModel,
  options: { rules?: Rule[]; signal?: AbortSignal } = {},
): Promise<ValidationIssue[]> => {
  const { rules, signal } = options;
  throwIfAborted(signal);

  const index = rules ? indexRules(rules) : RULES_INDEX;
  const issues: ValidationIssue[] = [];
  const yieldIfSliceElapsed = createTimeSlicer();

  for (const [id, asset] of model.assets) {
    await yieldIfSliceElapsed();
    throwIfAborted(signal);
    issues.push(...validateEntity(asset.type, id, asset, model, index));
  }

  for (const [id, customerPoint] of model.customerPoints) {
    await yieldIfSliceElapsed();
    throwIfAborted(signal);
    issues.push(
      ...validateEntity("customerPoint", id, customerPoint, model, index),
    );
  }

  return issues;
};
