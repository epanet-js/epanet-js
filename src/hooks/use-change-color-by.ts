import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { symbologyBuilders } from "src/map/symbology/symbology-builders";
import {
  SupportedProperty,
  nullSymbologySpec,
} from "src/map/symbology/symbology-types";
import { isSimulationProperty } from "src/map/symbology/symbology-data-source";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { useSymbologyState } from "src/state/map-symbology";
import { projectSettingsAtom } from "src/state/project-settings";
import { simulationResultsAtom } from "src/state/simulation";

export type ColorBySelection = SupportedProperty | "none";

export const useChangeColorBy = (geometryType: "node" | "link") => {
  const userTracking = useUserTracking();
  const simulationResults = useAtomValue(simulationResultsAtom);
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const { units } = useAtomValue(projectSettingsAtom);
  const { switchNodeSymbologyTo, switchLinkSymbologyTo } = useSymbologyState();

  return useCallback(
    (property: ColorBySelection) => {
      userTracking.capture({
        name: "map.colorBy.changed",
        type: geometryType,
        subtype: property,
      });

      const canApplySymbology =
        property === "none" ||
        !isSimulationProperty(property) ||
        !!simulationResults;

      if (geometryType === "node") {
        if (property === "none") {
          switchNodeSymbologyTo(null, () => nullSymbologySpec.node);
          return;
        }
        if (!canApplySymbology) return;
        switchNodeSymbologyTo(
          property,
          symbologyBuilders[property](
            hydraulicModel,
            units,
            simulationResults!,
          ),
        );
      } else {
        if (property === "none") {
          switchLinkSymbologyTo(null, () => nullSymbologySpec.link);
          return;
        }
        if (!canApplySymbology) return;
        switchLinkSymbologyTo(
          property,
          symbologyBuilders[property](
            hydraulicModel,
            units,
            simulationResults!,
          ),
        );
      }
    },
    [
      userTracking,
      geometryType,
      simulationResults,
      hydraulicModel,
      units,
      switchNodeSymbologyTo,
      switchLinkSymbologyTo,
    ],
  );
};
