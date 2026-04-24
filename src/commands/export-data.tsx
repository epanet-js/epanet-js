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
import { simulationStepAtom } from "src/state/simulation";
import type { HydraulicModel } from "src/hydraulic-model";
import type { Asset } from "src/hydraulic-model/asset-types";
import type { ResultsReader } from "src/simulation/results-reader";

export type DataExportOptions = {
  format: ExportFormat;
  includeSimulationResults: boolean;
};

export const useExportData = () => {
  const translate = useTranslate();

  const exportNetwork = useAtomCallback(
    useCallback(
      async (get, _set, options: DataExportOptions) => {
        const getResultsReader = async (): Promise<ResultsReader | null> => {
          if (!options.includeSimulationResults) return null;

          const simulation = get(simulationDerivedAtom);
          const simulationStep = get(simulationStepAtom);

          if (
            "epsResultsReader" in simulation &&
            simulation.epsResultsReader &&
            simulationStep !== null
          ) {
            const epsResultsReader = simulation.epsResultsReader;
            return await epsResultsReader?.getResultsForTimestep(
              simulationStep,
            );
          }

          return null;
        };

        const hydraulicModel = get(stagingModelDerivedAtom);
        const resultsReader = (await getResultsReader()) ?? undefined;

        const doExport = async () => {
          const data = buildDataForExport(
            options.format,
            hydraulicModel,
            resultsReader,
          );
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
  resultsReader?: ResultsReader,
): ExportedFile[] => {
  switch (format) {
    case "geojson": {
      const assets = Array.from(hydraulicModel.assets.values()).map((asset) => {
        const simulationResults = resultsReader
          ? getSimulationProps(asset, resultsReader)
          : {};

        return {
          ...asset.feature.properties,
          id: asset.id,
          geometry: { ...asset.feature.geometry },
          ...simulationResults,
        };
      });
      return [{ name: "network", data: assets }];
    }
    default:
      return [];
  }
};

const getSimulationProps = (
  asset: Asset,
  resultsReader: ResultsReader,
): Record<string, unknown> => {
  const getSimulationResults = {
    junction: () => resultsReader.getJunction(asset.id),
    tank: () => resultsReader.getTank(asset.id),
    reservoir: () => resultsReader.getReservoir(asset.id),
    pipe: () => resultsReader.getPipe(asset.id),
    pump: () => resultsReader.getPump(asset.id),
    valve: () => resultsReader.getValve(asset.id),
  };

  const sim = getSimulationResults[asset.type]();
  if (!sim) return {};

  return Object.fromEntries(
    Object.entries(sim).map(([key, value]) => [`sim_${key}`, value]),
  );
};
