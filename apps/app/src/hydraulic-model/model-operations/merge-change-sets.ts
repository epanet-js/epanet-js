import { squash, type ChangeSet } from "@epanet-js/change-set";

export const mergeChangeSets = (
  changeSets: ChangeSet[],
  name: string,
): ChangeSet | null => {
  if (changeSets.length === 0) return null;
  if (changeSets.length === 1) return changeSets[0];

  return squash(name, changeSets);
};
