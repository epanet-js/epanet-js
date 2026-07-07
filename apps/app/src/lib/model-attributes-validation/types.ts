import {
  AssetId,
  AssetType,
  Asset,
  CustomerPoint,
} from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "src/hydraulic-model";

export type Severity = "error" | "warning";

export type EntityType = AssetType | "customerPoint";

export type ValidatableEntity = Asset | CustomerPoint;

export type ValidationIssue = {
  ruleId: string;
  entityType: EntityType;
  entityId: AssetId;
  label: string | null;
  field: string | null;
  severity: Severity;
  message: string;
};

export type ValidationGroup = {
  ruleId: string;
  entityType: EntityType;
  field: string | null;
  severity: Severity;
  message: string;
  issues: ValidationIssue[];
};

export type RuleType = "field" | "entity" | "model";

export type Rule = {
  id: string;
  type: RuleType;
  entityType: EntityType;
  field?: string;
  accessor: (entity: ValidatableEntity, model: HydraulicModel) => unknown;
  appliesWhen?: (entity: ValidatableEntity, model?: HydraulicModel) => boolean;
  check: (
    value: unknown,
    entity?: ValidatableEntity,
    model?: HydraulicModel,
  ) => boolean;
  severity: Severity;
  message: string;
};
