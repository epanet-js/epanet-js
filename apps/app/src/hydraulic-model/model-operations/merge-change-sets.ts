import { squash, type ChangeSet } from "@epanet-js/change-set";
import type { OperationCode } from "../model-operation";

export const mergeChangeSets = (
  changeSets: ChangeSet[],
  code: OperationCode,
): ChangeSet | null => {
  if (changeSets.length === 0) return null;
  if (changeSets.length === 1) return changeSets[0];

  return squash(code, changeSets);
};
