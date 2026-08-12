import { AssetId } from "@epanet-js/hydraulic-model";
import {
  EntityType,
  RULES_BY_ID,
  Severity,
  ValidationIssues,
} from "src/lib/model-attributes-validation";

export type ValidationGroup = {
  ruleId: string;
  entityType: EntityType;
  severity: Severity;
  entityIds: AssetId[];
};

// The check already returns its rules in display order, so this only attaches
// the rule metadata the rows need.
export const groupIssues = (issues: ValidationIssues): ValidationGroup[] => {
  const groups: ValidationGroup[] = [];

  for (const [ruleId, entityIds] of issues) {
    const rule = RULES_BY_ID.get(ruleId);
    if (!rule) continue;

    groups.push({
      ruleId,
      entityType: rule.entityType,
      severity: rule.severity,
      entityIds,
    });
  }

  return groups;
};
