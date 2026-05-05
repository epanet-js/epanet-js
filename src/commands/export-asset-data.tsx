import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { Export, ExportFormat } from "src/lib/export";
import { notifyPromiseState } from "src/components/notifications";
import { useTranslate } from "src/hooks/use-translate";
import {
  stagingModelDerivedAtom,
  simulationDerivedAtom,
} from "src/state/derived-branch-state";
import { simulationStepAtom } from "src/state/simulation";
import { currentFileNameAtom } from "src/state/file-system";
import type { ResultsReader } from "src/simulation/results-reader";

export type DataExportOptions = {
  format: ExportFormat;
  includeSimulationResults: boolean;
  simulationStep?: number;
  selectedAssets: Set<number>;
};

export const useExportAssetData = () => {
  const translate = useTranslate();

  const exportNetwork = useAtomCallback(
    useCallback(
      async (get, _set, options: DataExportOptions) => {
        const getResultsReader = async (): Promise<ResultsReader | null> => {
          if (!options.includeSimulationResults) return null;

          const simulation = get(simulationDerivedAtom);
          const simulationStep =
            options.simulationStep ?? get(simulationStepAtom);

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
        const networkName = get(currentFileNameAtom);

        const doExport = async () => {
          const fileName = networkName ? `export-${networkName}` : "export";
          await Export.exportAssetData(
            fileName,
            options.format,
            hydraulicModel,
            options.includeSimulationResults,
            options.selectedAssets,
            resultsReader,
          );
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
