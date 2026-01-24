import type {
  BaseModelSnapshot,
  Scenario,
  Worktree,
} from "src/state/scenarios";
import { MomentLog } from "src/lib/persistence/moment-log";
import { nanoid } from "nanoid";

export const createScenario = (
  worktree: Worktree,
  baseSnapshot: BaseModelSnapshot,
): { scenario: Scenario; worktree: Worktree } => {
  const newNumber = worktree.highestScenarioNumber + 1;
  const newMomentLog = new MomentLog();
  newMomentLog.setSnapshot(baseSnapshot.moment, baseSnapshot.stateId);

  const newScenario: Scenario = {
    id: nanoid(),
    name: `Scenario #${newNumber}`,
    number: newNumber,
    createdAt: Date.now(),
    momentLog: newMomentLog,
    simulation: null,
    modelVersion: baseSnapshot.stateId,
  };

  const updatedScenarios = new Map(worktree.scenarios);
  updatedScenarios.set(newScenario.id, newScenario);

  return {
    scenario: newScenario,
    worktree: {
      ...worktree,
      scenarios: updatedScenarios,
      highestScenarioNumber: newNumber,
      baseModelSnapshot: baseSnapshot,
    },
  };
};
