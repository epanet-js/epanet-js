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
import { useUserTracking } from "src/infra/user-tracking";

export type ExportSimulationResultsOptions = {
  format: "csv" | "xlsx";
  selectedAssets: Set<number>;
  properties: ExportSimulationResultsProperties[];
  onProgress: (
    progress: number,
    property: ExportSimulationResultsProperties,
  ) => Promise<void>;
  signal?: AbortSignal;
};

export const useExportSimulationResults = () => {
  const { capture } = useUserTracking();

  const run = useAtomCallback(
    useCallback(
      async (get, _set, options: ExportSimulationResultsOptions) => {
        const hydraulicModel = get(stagingModelDerivedAtom);
        const simulation = get(simulationDerivedAtom);
        const networkFile = get(currentFileNameAtom) ?? "";
        const networkNameDot = networkFile.lastIndexOf(".");
        const networkName = networkFile.substring(
          0,
          networkNameDot < 0 ? networkFile.length - 1 : networkNameDot,
        );

        if (
          !("epsResultsReader" in simulation) ||
          !simulation.epsResultsReader
        ) {
          return;
        }

        const epsResultsReader = simulation.epsResultsReader;

        const extension = options.format === "xlsx" ? ".xlsx" : ".zip";
        const mimeType =
          options.format === "xlsx"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "application/zip";
        const description =
          options.format === "xlsx" ? "Excel Workbook" : "ZIP Archive";
        const fileName = `${networkName}-export${extension}`;

        const fileHandle = FileSystemHelpers.isFileSystemAccessSupported()
          ? await FileSystemHelpers.openFileInFileSystem(
              fileName,
              description,
              mimeType,
              extension,
            )
          : await FileSystemHelpers.openFileInOpfs(fileName);

        await Export.exportSimulationResults(
          options.format,
          networkName,
          fileHandle,
          hydraulicModel,
          epsResultsReader,
          options,
        );

        capture({
          name: "simulationResults.exported",
          format: options.format,
          properties: options.properties,
          hasSelection: options.selectedAssets.size > 0,
        });
      },
      [capture],
    ),
  );

  return run;
};
