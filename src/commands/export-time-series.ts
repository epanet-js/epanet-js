import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { Export } from "src/lib/export";
import { FileSystemHelpers } from "src/lib/export/file-system-helpers";
import { notifyPromiseState } from "src/components/notifications";
import { useTranslate } from "src/hooks/use-translate";
import {
  stagingModelDerivedAtom,
  simulationDerivedAtom,
} from "src/state/derived-branch-state";
import type { ExportTimeSeriesMetrics } from "src/lib/export/types";

export type ExportTimeSeriesOptions = {
  selectedAssets: Set<number>;
  metrics: ExportTimeSeriesMetrics[];
};

export const useExportTimeSeries = () => {
  const translate = useTranslate();

  const run = useAtomCallback(
    useCallback(
      async (get, _set, options: ExportTimeSeriesOptions) => {
        const hydraulicModel = get(stagingModelDerivedAtom);
        const simulation = get(simulationDerivedAtom);

        if (
          !("epsResultsReader" in simulation) ||
          !simulation.epsResultsReader
        ) {
          return;
        }

        const epsResultsReader = simulation.epsResultsReader;

        const directory = FileSystemHelpers.isFileSystemAccessSupported()
          ? await FileSystemHelpers.openDirectoryInFileSystem()
          : await FileSystemHelpers.openOpfsRootDirectory();

        const doExport = async () => {
          await Export.exportTimeSeries(
            directory,
            hydraulicModel,
            epsResultsReader,
            options.selectedAssets,
            options.metrics,
            () => {},
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

  return run;
};
