import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { buildInp } from "src/simulation/build-inp";
import { buildInpEPS } from "src/simulation/build-inp-eps";
import { dataAtom, dialogAtom, simulationAtom } from "src/state/jotai";
import { runSimulation as run } from "src/simulation";
import { attachSimulation } from "src/hydraulic-model";
import { useDrawingMode } from "./set-drawing-mode";
import { Mode } from "src/state/mode";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const runSimulationShortcut = "shift+enter";

export const useRunSimulation = () => {
  const setSimulationState = useSetAtom(simulationAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const { hydraulicModel } = useAtomValue(dataAtom);
  const setData = useSetAtom(dataAtom);
  const setDrawingMode = useDrawingMode();
  const isEPSEnabled = useFeatureFlag("FLAG_EPS");

  const runSimulation = useCallback(async () => {
    setDrawingMode(Mode.NONE);
    setSimulationState((prev) => ({ ...prev, status: "running" }));
    const inp = isEPSEnabled
      ? buildInpEPS(hydraulicModel, { customerDemands: true })
      : buildInp(hydraulicModel, { customerDemands: true });
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
  }, [
    setDrawingMode,
    hydraulicModel,
    setSimulationState,
    setData,
    setDialogState,
    isEPSEnabled,
  ]);

  return runSimulation;
};
