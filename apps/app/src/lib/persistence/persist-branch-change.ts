import type { ChangeSet, Direction } from "@epanet-js/change-set";
import type { Worktree } from "@epanet-js/worktree";
import { applyChangeSetToDb, applyChangeSetToDbDeprecated } from "src/lib/db";
import { getBranchStore } from "src/lib/branching";

type ApplyToMain = (
  changeSet: ChangeSet,
  direction: Direction,
) => Promise<void>;

const persistWith =
  (applyToMain: ApplyToMain) =>
  (
    worktree: Worktree,
    changeSet: ChangeSet,
    direction: Direction,
  ): Promise<void> =>
    worktree.activeBranchId === worktree.mainId
      ? applyToMain(changeSet, direction)
      : getBranchStore().recordChange(
          worktree.activeBranchId,
          changeSet,
          direction,
        );

export const persistBranchChange = persistWith(applyChangeSetToDb);

export const persistBranchChangeDeprecated = persistWith(
  applyChangeSetToDbDeprecated,
);

export type PersistBranchChange = typeof persistBranchChange;
