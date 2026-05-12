import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { Export } from "src/lib/export";
import { FileSystemHelpers } from "src/lib/export/file-system-helpers";
import {
  stagingModelDerivedAtom,
  simulationDerivedAtom,
} from "src/state/derived-branch-state";
import type { ExportSimulationResultsProperties } from "src/lib/export/types";
import { currentFileNameAtom } from "src/state";

export type ExportSimulationResultsOptions = {
  selectedAssets: Set<number>;
  metrics: ExportSimulationResultsProperties[];
  onProgress: (progress: number) => Promise<void>;
  signal?: AbortSignal;
};

export const useExportSimulationResults = () => {
  const run = useAtomCallback(
    useCallback(async (get, _set, options: ExportSimulationResultsOptions) => {
      const hydraulicModel = get(stagingModelDerivedAtom);
      const simulation = get(simulationDerivedAtom);
      const networkFile = get(currentFileNameAtom) ?? "";
      const networkNameDot = networkFile.lastIndexOf(".");
      const networkName = networkFile.substring(
        0,
        networkNameDot < 0 ? networkFile.length - 1 : networkNameDot,
      );

      if (!("epsResultsReader" in simulation) || !simulation.epsResultsReader) {
        return;
      }

      const epsResultsReader = simulation.epsResultsReader;

      const directory = FileSystemHelpers.isFileSystemAccessSupported()
        ? await FileSystemHelpers.openDirectoryInFileSystem()
        : await FileSystemHelpers.openOpfsRootDirectory();

      await Export.exportSimulationResults(
        "csv",
        networkName,
        directory,
        hydraulicModel,
        epsResultsReader,
        options,
      );
    }, []),
  );

  return run;
};
