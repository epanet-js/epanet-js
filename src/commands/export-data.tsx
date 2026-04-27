import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { Export, ExportFormat } from "src/lib/export";
import type { ExportEntry } from "src/lib/export/types";
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
import type { fileSave as fileSaveType } from "browser-fs-access";

const getDefaultFsAccess = async () => {
  const { fileSave } = await import("browser-fs-access");
  return { fileSave };
};

type FileAccess = { fileSave: typeof fileSaveType };

export type DataExportOptions = {
  format: ExportFormat;
  includeSimulationResults: boolean;
  simulationStep?: number;
  exportAllResultsAsCsv?: boolean;
};

export const useExportData = ({
  getFsAccess = getDefaultFsAccess,
}: { getFsAccess?: () => Promise<FileAccess> } = {}) => {
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

        const doExport = async () => {
          const { fileSave } = await getFsAccess();

          const data = buildDataForExport(
            options.format,
            hydraulicModel,
            resultsReader,
          );

          if (options.exportAllResultsAsCsv) {
            const simulation = get(simulationDerivedAtom);
            if (
              "epsResultsReader" in simulation &&
              simulation.epsResultsReader
            ) {
              const allResultsData = await buildAllTimestepsForExport(
                hydraulicModel,
                simulation.epsResultsReader,
              );

              data.push(...allResultsData);
            }
          }

          const fileName = "export";
          const exportedFile = await Export.exportFile(fileName, data);

          const saveOptions = {
            mimeTypes: exportedFile.mimeTypes,
            description: exportedFile.description,
            extensions: exportedFile.extensions,
            fileName: exportedFile.fileName,
          };
          await fileSave(exportedFile.blob, saveOptions, null);
        };

        try {
          await notifyPromiseState(doExport(), {
            loading: translate("exporting"),
            success: translate("exported"),
            error: translate("exportFailed"),
          });
        } catch {}
      },
      [translate, getFsAccess],
    ),
  );

  return exportNetwork;
};

const buildDataForExport = (
  format: ExportFormat,
  hydraulicModel: HydraulicModel,
  resultsReader?: ResultsReader,
): ExportEntry[] => {
  const exportedAssets: Record<string, object[]> = {
    junction: [],
    tank: [],
    reservoir: [],
    pipe: [],
    pump: [],
    valve: [],
  };

  Array.from(hydraulicModel.assets.values()).forEach((asset) => {
    const simulationResults = resultsReader
      ? getSimulationProps(asset, resultsReader)
      : {};

    exportedAssets[asset.type].push({
      ...asset.feature.properties,
      id: asset.id,
      geometry: { ...asset.feature.geometry },
      ...simulationResults,
    });
  });

  return [
    { format, name: "junction", data: exportedAssets.junction },
    { format, name: "tank", data: exportedAssets.tank },
    { format, name: "reservoir", data: exportedAssets.reservoir },
    { format, name: "pipe", data: exportedAssets.pipe },
    { format, name: "pump", data: exportedAssets.pump },
    { format, name: "valve", data: exportedAssets.valve },
  ];
};

const formatTimestep = (index: number, intervalSeconds: number): string => {
  const total = index * intervalSeconds;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

type EPSResultsReaderLike = {
  timestepCount: number;
  reportingTimeStep: number;
  getResultsForTimestep: (step: number) => Promise<ResultsReader>;
};

const buildAllTimestepsForExport = async (
  hydraulicModel: HydraulicModel,
  epsResultsReader: EPSResultsReaderLike,
): Promise<ExportEntry[]> => {
  const { timestepCount, reportingTimeStep } = epsResultsReader;
  const assets = Array.from(hydraulicModel.assets.values());

  const accumulated: Record<string, object[]> = {
    junction: [],
    tank: [],
    reservoir: [],
    pipe: [],
    pump: [],
    valve: [],
  };

  for (let step = 0; step < timestepCount; step++) {
    const reader = await epsResultsReader.getResultsForTimestep(step);
    const timestep = formatTimestep(step, reportingTimeStep);

    assets.forEach((asset) => {
      accumulated[asset.type].push({
        timestep,
        label: asset.label,
        ...getSimulationProps(asset, reader),
      });
    });
  }

  return [
    { format: "csv", name: "sim_junction", data: accumulated.junction },
    { format: "csv", name: "sim_tank", data: accumulated.tank },
    { format: "csv", name: "sim_reservoir", data: accumulated.reservoir },
    { format: "csv", name: "sim_pipe", data: accumulated.pipe },
    { format: "csv", name: "sim_pump", data: accumulated.pump },
    { format: "csv", name: "sim_valve", data: accumulated.valve },
  ];
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
