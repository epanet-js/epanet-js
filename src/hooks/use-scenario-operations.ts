import { useSetAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
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
  const setWorktree = useSetAtom(worktreeAtom);
  const setSimulation = useSetAtom(simulationAtom);
  const setMode = useSetAtom(modeAtom);

  const switchToMain = useAtomCallback(
    useCallback(
      (get) => {
        const worktree = get(worktreeAtom);
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
      },
      [persistence, setWorktree, setSimulation, setMode],
    ),
  );

  const switchToSnapshot = useAtomCallback(
    useCallback(
      (get, _set, snapshotId: string) => {
        const worktree = get(worktreeAtom);
        const result = switchToSnapshotFn(worktree, snapshotId);

        if (result.snapshot) {
          persistence.applySnapshot(result.worktree, result.snapshot.id);
        }

        setWorktree(result.worktree);
        setSimulation(
          getSimulationForState(result.worktree, initialSimulationState),
        );
      },
      [persistence, setWorktree, setSimulation],
    ),
  );

  const switchToScenario = useAtomCallback(
    useCallback(
      (get, _set, scenarioId: string) => {
        const worktree = get(worktreeAtom);
        const result = switchToScenarioFn(worktree, scenarioId);

        if (result.snapshot) {
          persistence.applySnapshot(result.worktree, result.snapshot.id);
        }

        setWorktree(result.worktree);
        setSimulation(
          getSimulationForState(result.worktree, initialSimulationState),
        );
      },
      [persistence, setWorktree, setSimulation],
    ),
  );

  const createNewScenario = useAtomCallback(
    useCallback(
      (get) => {
        const worktree = get(worktreeAtom);
        const created = createScenario(worktree);
        const result = switchToScenarioFn(
          created.worktree,
          created.scenario.id,
        );

        if (result.snapshot) {
          persistence.applySnapshot(result.worktree, result.snapshot.id);
        }

        setWorktree(result.worktree);
        setSimulation(initialSimulationState);

        return {
          scenarioId: created.scenario.id,
          scenarioName: created.scenario.name,
        };
      },
      [persistence, setWorktree, setSimulation],
    ),
  );

  const deleteScenarioById = useAtomCallback(
    useCallback(
      (get, _set, scenarioId: string) => {
        const worktree = get(worktreeAtom);
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
      [persistence, setWorktree, setSimulation],
    ),
  );

  const renameScenarioById = useAtomCallback(
    useCallback(
      (get, _set, scenarioId: string, newName: string) => {
        const worktree = get(worktreeAtom);
        setWorktree(renameScenario(worktree, scenarioId, newName));
      },
      [setWorktree],
    ),
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
