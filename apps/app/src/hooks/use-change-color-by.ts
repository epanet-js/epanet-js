import { useAtomValue } from "jotai";
import { useCallback, useState } from "react";
import { useMapThemeEditTracking } from "src/hooks/use-map-theme-edit-tracking";
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
import { useSymbologyState } from "src/hooks/use-symbology-state";
import { projectSettingsAtom } from "src/state/project-settings";
import { isColorPropertyAvailable } from "src/map/symbology/property-availability";

export type ColorBySelection = SupportedProperty | null;

const absValuesFor = (property: SupportedProperty): boolean =>
  property === "flow";

export const useChangeColorBy = (geometryType: "node" | "link") => {
  const mapThemeTracking = useMapThemeEditTracking();
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
      mapThemeTracking.captureChange({
        change: `${geometryType}ColorBy`,
        value: property ?? "none",
      });

      if (property === null) {
        if (geometryType === "node") {
          switchNodeSymbologyTo(null, () => nullSymbologySpec.node);
        } else {
          switchLinkSymbologyTo(null, () => nullSymbologySpec.link);
        }
        return;
      }

      const canApplySymbology =
        !isSimulationProperty(property) || !!simulationResults;
      const hasData =
        canApplySymbology && isColorPropertyAvailable(property, simulation);

      setIsWorking(true);
      try {
        const sortedData = !hasData ? [] : await fetchSortedData(property);
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
      mapThemeTracking,
      geometryType,
      simulationResults,
      units,
      switchNodeSymbologyTo,
      switchLinkSymbologyTo,
      fetchSortedData,
      simulation,
    ],
  );

  return { changeColorBy, isWorking };
};
