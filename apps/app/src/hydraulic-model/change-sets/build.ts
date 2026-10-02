import { ChangeSet, type ChangeRecord } from "@epanet-js/change-set";
import type { HydraulicModel } from "../hydraulic-model";
import type { OperationCode } from "../model-operation";
import { validateRecords } from "./validate";

export type Intent = (model: HydraulicModel, out: ChangeRecord[]) => void;

export const changeSet = (
  model: HydraulicModel,
  code: OperationCode,
  intents: readonly Intent[],
): ChangeSet => {
  const records: ChangeRecord[] = [];
  for (const intent of intents) intent(model, records);
  validateRecords(records);
  return ChangeSet.of(code, records);
};
