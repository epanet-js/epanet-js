import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { buildInp } from "src/simulation/build-inp";
import { dataAtom, dialogAtom, simulationAtom } from "src/state/jotai";
import { runSimulation as run } from "src/simulation";
import { attachSimulation } from "src/hydraulic-model";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const runSimulationShortcut = "shift+enter";

export const useRunSimulation = () => {
  const setSimulationState = useSetAtom(simulationAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const { hydraulicModel } = useAtomValue(dataAtom);
  const setData = useSetAtom(dataAtom);
  const isCustomerPointOn = useFeatureFlag("FLAG_CUSTOMER_POINT");

  const runSimulation = useCallback(async () => {
    setSimulationState((prev) => ({ ...prev, status: "running" }));
    const inp = buildInp(hydraulicModel, {
      customerDemands: isCustomerPointOn,
    });
    const start = performance.now();
    setDialogState({ type: "loading" });
    const { report, status, results } = await run(inp);

    attachSimulation(hydraulicModel, results);
    setData((prev) => ({
      ...prev,
      hydraulicModel,
    }));

    setSimulationState({
      status,
      report,
      modelVersion: hydraulicModel.version,
    });
    const end = performance.now();
    const duration = end - start;
    setDialogState({
      type: "simulationSummary",
      status,
      duration,
    });
  }, [
    hydraulicModel,
    setSimulationState,
    setData,
    setDialogState,
    isCustomerPointOn,
  ]);

  return runSimulation;
};
