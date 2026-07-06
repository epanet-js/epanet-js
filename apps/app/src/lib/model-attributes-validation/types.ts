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

export type RuleType = "field" | "entity";

export type Rule = {
  id: string;
  type: RuleType;
  entityType: EntityType;
  field?: string;
  accessor: (entity: ValidatableEntity, model: HydraulicModel) => unknown;
  appliesWhen?: (entity: ValidatableEntity, model?: HydraulicModel) => boolean;
  // entity arg only needed for entity-scoped checks.
  check: (value: unknown, entity?: ValidatableEntity) => boolean;
  severity: Severity;
  message: string;
};
