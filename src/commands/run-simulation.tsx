import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { buildInp } from "src/simulation/build-inp";
import { buildInpEPS } from "src/simulation/build-inp-eps";
import { dataAtom, dialogAtom, simulationAtom } from "src/state/jotai";
import {
  ProgressCallback,
  runSimulation,
  runEPSSimulation,
  EPSResultsReader,
} from "src/simulation";
import { attachSimulation } from "src/hydraulic-model";
import { useDrawingMode } from "./set-drawing-mode";
import { Mode } from "src/state/mode";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { getAppId } from "src/infra/app-instance";
import { OPFSStorage } from "src/infra/storage";

export const runSimulationShortcut = "shift+enter";

export const useRunSimulation = () => {
  const setSimulationState = useSetAtom(simulationAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const { hydraulicModel } = useAtomValue(dataAtom);
  const setData = useSetAtom(dataAtom);
  const setDrawingMode = useDrawingMode();
  const isEPSEnabled = useFeatureFlag("FLAG_EPS");

  const runSimulationLegacy = useCallback(async () => {
    setDrawingMode(Mode.NONE);
    setSimulationState((prev) => ({ ...prev, status: "running" }));
    const inp = buildInp(hydraulicModel, { customerDemands: true });
    const start = performance.now();
    setDialogState({ type: "loading" });
    const { report, status, results } = await runSimulation(inp);

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
  ]);

  const runSimulationEPS = useCallback(async () => {
    setDrawingMode(Mode.NONE);
    setSimulationState((prev) => ({ ...prev, status: "running" }));
    const inp = buildInpEPS(hydraulicModel, { customerDemands: true });
    const start = performance.now();

    let isCompleted = false;

    setDialogState({
      type: "simulationProgress",
      currentTime: 0,
      totalDuration: 0,
    });

    const reportProgress: ProgressCallback = (progress) => {
      if (isCompleted) return;
      setDialogState({
        type: "simulationProgress",
        ...progress,
      });
    };

    const appId = getAppId();
    const { report, status, metadata } = await runEPSSimulation(
      inp,
      appId,
      {},
      reportProgress,
    );

    isCompleted = true;

    let updatedHydraulicModel = hydraulicModel;
    let simulationIds;
    if (status === "success" || status === "warning") {
      const storage = new OPFSStorage(appId);
      const epsReader = new EPSResultsReader(storage);
      await epsReader.initialize(metadata);
      simulationIds = epsReader.simulationIds;
      const resultsReader = await epsReader.getResultsForTimestep(0);
      updatedHydraulicModel = attachSimulation(hydraulicModel, resultsReader);
      setData((prev) => ({
        ...prev,
        hydraulicModel: updatedHydraulicModel,
      }));
    }

    setSimulationState({
      status,
      report,
      modelVersion: updatedHydraulicModel.version,
      metadata,
      simulationIds,
      currentTimestepIndex: 0,
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
    setDialogState,
    setData,
  ]);

  return isEPSEnabled ? runSimulationEPS : runSimulationLegacy;
};
