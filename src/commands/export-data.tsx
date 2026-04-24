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
          const { fileSave } = await getFsAccess();

          const data = buildDataForExport(hydraulicModel, resultsReader);

          const fileName = "export";
          const exportedFile = Export.exportFile(
            options.format,
            fileName,
            data,
          );

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
    { name: "junction", data: exportedAssets.junction },
    { name: "tank", data: exportedAssets.tank },
    { name: "reservoir", data: exportedAssets.reservoir },
    { name: "pipe", data: exportedAssets.pipe },
    { name: "pump", data: exportedAssets.pump },
    { name: "valve", data: exportedAssets.valve },
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
