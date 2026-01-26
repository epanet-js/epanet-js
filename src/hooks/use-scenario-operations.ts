import { useAtom, useSetAtom } from "jotai";
import { useCallback } from "react";
import { usePersistence } from "src/lib/persistence/context";
import { MemPersistence } from "src/lib/persistence/memory";
import { worktreeAtom } from "src/state/scenarios";
import { initialSimulationState, simulationAtom } from "src/state/jotai";
import { modeAtom, Mode } from "src/state/mode";
import {
  initializeWorktree,
  createScenario,
  switchToSnapshot as switchToSnapshotFn,
  switchToScenario as switchToScenarioFn,
  switchToMain as switchToMainFn,
  deleteScenario,
  renameScenario,
  getSimulationForState,
} from "src/lib/scenarios";
import type { ScenarioContext } from "src/lib/scenarios";

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
  const persistence = usePersistence() as MemPersistence;
  const [worktree, setWorktree] = useAtom(worktreeAtom);
  const setSimulation = useSetAtom(simulationAtom);
  const setMode = useSetAtom(modeAtom);

  const getContext = useCallback(
    (): ScenarioContext => ({
      currentMomentLog: persistence.getMomentLog(),
      currentModelVersion: persistence.getModelVersion(),
      currentSimulation: persistence.getSimulation(),
    }),
    [persistence],
  );

  const switchToMain = useCallback(() => {
    const result = switchToMainFn(worktree);

    if (result.snapshot) {
      persistence.applySnapshot(result.snapshot);
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
        persistence.applySnapshot(result.snapshot);
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
        persistence.applySnapshot(result.snapshot);
      }

      setWorktree(result.worktree);
      setSimulation(
        getSimulationForState(result.worktree, initialSimulationState),
      );
    },
    [persistence, worktree, setWorktree, setSimulation],
  );

  const createNewScenario = useCallback(() => {
    const initialized =
      worktree.scenarios.length === 0
        ? initializeWorktree(persistence.captureModelSnapshot(), getContext())
        : worktree;

    const created = createScenario(initialized);
    const result = switchToScenarioFn(created.worktree, created.scenario.id);

    if (result.snapshot) {
      persistence.applySnapshot(result.snapshot);
    }

    setWorktree(result.worktree);
    setSimulation(initialSimulationState);

    return {
      scenarioId: created.scenario.id,
      scenarioName: created.scenario.name,
    };
  }, [persistence, worktree, getContext, setWorktree, setSimulation]);

  const deleteScenarioById = useCallback(
    (scenarioId: string) => {
      const result = deleteScenario(worktree, scenarioId);

      if (result.snapshot) {
        persistence.applySnapshot(result.snapshot);
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
