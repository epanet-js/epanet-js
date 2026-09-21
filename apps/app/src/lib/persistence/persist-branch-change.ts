import type { ChangeSet, Direction } from "@epanet-js/change-set";
import type { Worktree } from "@epanet-js/worktree";
import { applyChangeSetToDb } from "src/lib/db";
import { getBranchStore } from "src/lib/branching";

export const persistBranchChange = (
  worktree: Worktree,
  changeSet: ChangeSet,
  direction: Direction,
): Promise<void> =>
  worktree.activeBranchId === worktree.mainId
    ? applyChangeSetToDb(changeSet, direction)
    : getBranchStore().recordChange(
        worktree.activeBranchId,
        changeSet,
        direction,
      );
