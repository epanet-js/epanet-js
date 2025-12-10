import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useContext } from "react";
import { buildInpEPS } from "src/simulation/build-inp-eps";
import { dataAtom, dialogAtom, simulationAtom } from "src/state/jotai";
import { runSimulation as run } from "src/simulation";
import { attachSimulation } from "src/hydraulic-model";
import { useDrawingMode } from "./set-drawing-mode";
import { Mode } from "src/state/mode";
import { MapContext } from "src/map";
import { runSimulationPerformanceTest } from "./run-simulation-performance-test";

export const runSimulationShortcut = "shift+enter";

export const useRunSimulation = () => {
  const setSimulationState = useSetAtom(simulationAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const { hydraulicModel } = useAtomValue(dataAtom);
  const setData = useSetAtom(dataAtom);
  const setDrawingMode = useDrawingMode();
  const mapEngine = useContext(MapContext);

  const runSimulation = useCallback(async () => {
    setDrawingMode(Mode.NONE);
    setSimulationState((prev) => ({ ...prev, status: "running" }));
    // Always use EPS path in spike branch
    const inp = buildInpEPS(hydraulicModel, { customerDemands: true });
    // eslint-disable-next-line no-console
    console.log("[PERF-TEST] INP file content:\n", inp);
    const start = performance.now();
    setDialogState({ type: "loading" });
    const { report, status, results } = await run(inp);

    const updatedHydraulicModel = attachSimulation(hydraulicModel, results);
    setData((prev) => ({
      ...prev,
      hydraulicModel: updatedHydraulicModel,
    }));

    setSimulationState({
      status,
      report,
      modelVersion: updatedHydraulicModel.version,
    });
    const end = performance.now();
    const duration = end - start;
    setDialogState({
      type: "simulationSummary",
      status,
      duration,
    });

    // Run performance test after simulation completes
    if (mapEngine) {
      await runSimulationPerformanceTest(
        updatedHydraulicModel,
        mapEngine,
        setData,
        setSimulationState,
      );
    }
  }, [
    setDrawingMode,
    hydraulicModel,
    setSimulationState,
    setData,
    setDialogState,
    mapEngine,
  ]);

  return runSimulation;
};
