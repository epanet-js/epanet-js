import { ChangeSet, type ChangeRecord } from "@epanet-js/change-set";
import type { HydraulicModel } from "../hydraulic-model";

export type Intent = (model: HydraulicModel, out: ChangeRecord[]) => void;

export const changeSet = (
  model: HydraulicModel,
  name: string,
  intents: readonly Intent[],
): ChangeSet => {
  const records: ChangeRecord[] = [];
  for (const intent of intents) intent(model, records);
  return ChangeSet.of(name, records);
};
