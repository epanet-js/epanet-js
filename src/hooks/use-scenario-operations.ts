import { useAtom, useSetAtom } from "jotai";
import { useCallback } from "react";
import { usePersistenceWithSnapshots } from "src/lib/persistence";
import { worktreeAtom } from "src/state/scenarios";
import { initialSimulationState, simulationAtom } from "src/state/jotai";
import { modeAtom, Mode } from "src/state/mode";
import {
  createScenario,
  switchToSnapshot as switchToSnapshotFn,
  switchToScenario as switchToScenarioFn,
  switchToMain as switchToMainFn,
  deleteScenario,
  renameScenario,
  getSimulationForState,
} from "src/lib/worktree";

const DRAWING_MODES: Mode[] = [
  Mode.DRAW_JUNCTION,
  Mode.DRAW_PIPE,
  Mode.DRAW_RESERVOIR,
  Mode.DRAW_PUMP,
  Mode.DRAW_VALVE,
  Mode.DRAW_TANK,
  Mode.CONNECT_CUSTOMER_POINTS,
  Mode.REDRAW_LINK,
];

export const useScenarioOperations = () => {
  const persistence = usePersistenceWithSnapshots();
  const [worktree, setWorktree] = useAtom(worktreeAtom);
  const setSimulation = useSetAtom(simulationAtom);
  const setMode = useSetAtom(modeAtom);

  const switchToMain = useCallback(() => {
    const result = switchToMainFn(worktree);

    if (result.snapshot) {
      persistence.applySnapshot(result.worktree, result.snapshot.id);
    }

    setWorktree(result.worktree);
    setSimulation(
      getSimulationForState(result.worktree, initialSimulationState),
    );

    setMode((modeState) => {
      if (DRAWING_MODES.includes(modeState.mode)) {
        return { mode: Mode.NONE };
      }
      return modeState;
    });
  }, [persistence, worktree, setWorktree, setSimulation, setMode]);

  const switchToSnapshot = useCallback(
    (snapshotId: string) => {
      const result = switchToSnapshotFn(worktree, snapshotId);

      if (result.snapshot) {
        persistence.applySnapshot(result.worktree, result.snapshot.id);
      }

      setWorktree(result.worktree);
      setSimulation(
        getSimulationForState(result.worktree, initialSimulationState),
      );
    },
    [persistence, worktree, setWorktree, setSimulation],
  );

  const switchToScenario = useCallback(
    (scenarioId: string) => {
      const result = switchToScenarioFn(worktree, scenarioId);

      if (result.snapshot) {
        persistence.applySnapshot(result.worktree, result.snapshot.id);
      }

      setWorktree(result.worktree);
      setSimulation(
        getSimulationForState(result.worktree, initialSimulationState),
      );
    },
    [persistence, worktree, setWorktree, setSimulation],
  );

  const createNewScenario = useCallback(() => {
    const created = createScenario(worktree);
    const result = switchToScenarioFn(created.worktree, created.scenario.id);

    if (result.snapshot) {
      persistence.applySnapshot(result.worktree, result.snapshot.id);
    }

    setWorktree(result.worktree);
    setSimulation(initialSimulationState);

    return {
      scenarioId: created.scenario.id,
      scenarioName: created.scenario.name,
    };
  }, [persistence, worktree, setWorktree, setSimulation]);

  const deleteScenarioById = useCallback(
    (scenarioId: string) => {
      const result = deleteScenario(worktree, scenarioId);

      persistence.deleteSnapshotFromCache(scenarioId);

      if (result.snapshot) {
        persistence.applySnapshot(result.worktree, result.snapshot.id);
      }

      setWorktree(result.worktree);
      setSimulation(
        getSimulationForState(result.worktree, initialSimulationState),
      );
    },
    [persistence, worktree, setWorktree, setSimulation],
  );

  const renameScenarioById = useCallback(
    (scenarioId: string, newName: string) => {
      setWorktree(renameScenario(worktree, scenarioId, newName));
    },
    [worktree, setWorktree],
  );

  return {
    switchToSnapshot,
    switchToMain,
    switchToScenario,
    createNewScenario,
    deleteScenarioById,
    renameScenarioById,
  };
};
