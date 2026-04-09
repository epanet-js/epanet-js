import { useAtomValue } from "jotai";
import { useCallback, useState } from "react";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useGetEpsResultsReader } from "src/hooks/use-eps-results-reader";
import { useUserTracking } from "src/infra/user-tracking";
import { symbologyBuilders } from "src/map/symbology/symbology-builders";
import {
  getSortedDataForProperty,
  getSortedSimulationDataForBreaks,
  isSimulationProperty,
} from "src/map/symbology/symbology-data-source";
import {
  SupportedProperty,
  nullSymbologySpec,
} from "src/map/symbology/symbology-types";
import { getSimulationMetadata } from "src/simulation/epanet/simulation-metadata";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { useSymbologyState } from "src/state/map-symbology";
import { projectSettingsAtom } from "src/state/project-settings";
import { simulationAtom, simulationResultsAtom } from "src/state/simulation";
import { simulationResultsDerivedAtom } from "src/state/derived-branch-state";

export type ColorBySelection = SupportedProperty | "none";

const absValuesFor = (property: SupportedProperty): boolean =>
  property === "flow";

export const useChangeColorBy = (geometryType: "node" | "link") => {
  const isStateRefactorOn = useFeatureFlag("FLAG_STATE_REFACTOR");
  const userTracking = useUserTracking();
  const simulation = useAtomValue(simulationAtom);
  const simulationResults = useAtomValue(
    isStateRefactorOn ? simulationResultsDerivedAtom : simulationResultsAtom,
  );
  const hydraulicModel = useAtomValue(
    isStateRefactorOn ? stagingModelDerivedAtom : stagingModelAtom,
  );
  const { units } = useAtomValue(projectSettingsAtom);
  const { switchNodeSymbologyTo, switchLinkSymbologyTo } = useSymbologyState();
  const isWaterAgeOn = useFeatureFlag("FLAG_WATER_AGE");
  const getEpsResultsReader = useGetEpsResultsReader();
  const [isWorking, setIsWorking] = useState(false);

  const isEpsSimulation =
    (simulation.status === "success" || simulation.status === "warning") &&
    !!simulation.metadata &&
    getSimulationMetadata(simulation.metadata).reportingStepsCount > 1;

  const fetchSortedData = useCallback(
    async (property: SupportedProperty): Promise<number[] | null> => {
      const absValues = absValuesFor(property);

      if (isWaterAgeOn && isEpsSimulation && isSimulationProperty(property)) {
        const epsReader = await getEpsResultsReader();
        if (epsReader) {
          const sorted = await getSortedSimulationDataForBreaks(
            property,
            { mode: "initial", epsReader },
            { absValues },
          );
          if (sorted) return sorted;
        }
      }

      return getSortedDataForProperty(
        property,
        hydraulicModel,
        simulationResults,
        { absValues },
      );
    },
    [
      isWaterAgeOn,
      isEpsSimulation,
      getEpsResultsReader,
      hydraulicModel,
      simulationResults,
    ],
  );

  const changeColorBy = useCallback(
    async (property: ColorBySelection) => {
      userTracking.capture({
        name: "map.colorBy.changed",
        type: geometryType,
        subtype: property,
      });

      if (property === "none") {
        if (geometryType === "node") {
          switchNodeSymbologyTo(null, () => nullSymbologySpec.node);
        } else {
          switchLinkSymbologyTo(null, () => nullSymbologySpec.link);
        }
        return;
      }

      const canApplySymbology =
        !isSimulationProperty(property) || !!simulationResults;
      if (!canApplySymbology) return;

      setIsWorking(true);
      try {
        const sortedData = await fetchSortedData(property);
        if (!sortedData) return;

        if (geometryType === "node") {
          switchNodeSymbologyTo(property, () =>
            symbologyBuilders[property](units, sortedData),
          );
        } else {
          switchLinkSymbologyTo(property, () =>
            symbologyBuilders[property](units, sortedData),
          );
        }
      } finally {
        setIsWorking(false);
      }
    },
    [
      userTracking,
      geometryType,
      simulationResults,
      units,
      switchNodeSymbologyTo,
      switchLinkSymbologyTo,
      fetchSortedData,
    ],
  );

  return { changeColorBy, isWorking };
};
