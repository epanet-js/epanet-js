import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { Export, ExportFormat } from "src/lib/export";
import type { ExportedFile } from "src/lib/export/types";
import { notifyPromiseState } from "src/components/notifications";
import { useTranslate } from "src/hooks/use-translate";
import {
  stagingModelDerivedAtom,
  simulationDerivedAtom,
} from "src/state/derived-branch-state";
import type { EPSResultsReader } from "src/simulation";
import type { HydraulicModel } from "src/hydraulic-model";

export type DataExportOptions = {
  format: ExportFormat;
  includeSimulationResults: boolean;
};

export const useExportData = () => {
  const translate = useTranslate();

  const exportNetwork = useAtomCallback(
    useCallback(
      async (get, _set, options: DataExportOptions) => {
        const getResultsReader = (): EPSResultsReader | undefined => {
          if (!options.includeSimulationResults) return;

          const simulation = get(simulationDerivedAtom);
          if ("epsResultsReader" in simulation && simulation.epsResultsReader) {
            return simulation.epsResultsReader;
          }
        };

        const hydraulicModel = get(stagingModelDerivedAtom);
        const epsResultsReader = getResultsReader();

        const data = buildDataForExport(
          options.format,
          hydraulicModel,
          epsResultsReader,
        );

        const doExport = (): Promise<void> => {
          Export.exportFile(options.format, data);
          return Promise.resolve();
        };

        try {
          await notifyPromiseState(doExport(), {
            loading: translate("exporting"),
            success: translate("exported"),
            error: translate("exportFailed"),
          });
        } catch {}
      },
      [translate],
    ),
  );

  return exportNetwork;
};

const buildDataForExport = (
  format: ExportFormat,
  hydraulicModel: HydraulicModel,
  _epsResultsReader?: EPSResultsReader,
): ExportedFile[] => {
  switch (format) {
    case "geojson": {
      const assets = Array.from(hydraulicModel.assets.values()).map(
        (asset) => ({
          ...asset.feature.properties,
          id: asset.id,
          geometry: { ...asset.feature.geometry },
        }),
      );
      return [{ name: "network", data: assets }];
    }
    default:
      return [];
  }
};
