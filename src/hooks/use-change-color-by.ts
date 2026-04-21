import { useAtomValue } from "jotai";
import { useCallback, useState } from "react";
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
import {
  simulationDerivedAtom,
  stagingModelDerivedAtom,
  simulationResultsDerivedAtom,
} from "src/state/derived-branch-state";
import { useSymbologyState } from "src/state/map-symbology";
import { projectSettingsAtom } from "src/state/project-settings";

export type ColorBySelection = SupportedProperty | "none";

const absValuesFor = (property: SupportedProperty): boolean =>
  property === "flow";

export const useChangeColorBy = (geometryType: "node" | "link") => {
  const userTracking = useUserTracking();
  const simulation = useAtomValue(simulationDerivedAtom);
  const simulationResults = useAtomValue(simulationResultsDerivedAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { units } = useAtomValue(projectSettingsAtom);
  const { switchNodeSymbologyTo, switchLinkSymbologyTo } = useSymbologyState();
  const [isWorking, setIsWorking] = useState(false);

  const fetchSortedData = useCallback(
    async (property: SupportedProperty): Promise<number[] | null> => {
      if (property === "waterTrace") return [];

      const absValues = absValuesFor(property);

      const isEpsSimulation =
        "epsResultsReader" in simulation &&
        (simulation.epsResultsReader?.timestepCount ?? 0) > 1;

      if (isEpsSimulation && isSimulationProperty(property)) {
        const epsReader = simulation.epsResultsReader!;
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
    [hydraulicModel, simulationResults, simulation],
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
