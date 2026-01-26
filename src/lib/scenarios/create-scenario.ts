import type { Worktree, Snapshot } from "src/state/scenarios";
import { MomentLog } from "src/lib/persistence/moment-log";
import { nanoid } from "nanoid";

export const createScenario = (
  worktree: Worktree,
): { scenario: Snapshot; worktree: Worktree } => {
  const base = worktree.mainRevision.base;
  const newNumber = worktree.highestScenarioNumber + 1;
  const newMomentLog = new MomentLog();
  newMomentLog.setSnapshot(base.moment, base.stateId);

  const newScenario: Snapshot = {
    id: nanoid(),
    name: `Scenario #${newNumber}`,
    base,
    version: base.stateId,
    momentLog: newMomentLog,
    simulation: null,
    status: "open",
  };

  const updatedScenarios = new Map(worktree.scenarios);
  updatedScenarios.set(newScenario.id, newScenario);

  return {
    scenario: newScenario,
    worktree: {
      ...worktree,
      scenarios: updatedScenarios,
      highestScenarioNumber: newNumber,
    },
  };
};
