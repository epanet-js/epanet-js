import { Asset, AssetType, HydraulicModel } from "src/hydraulic-model";
import { ResultsReader } from "src/simulation";
import { ExportedFile } from "../types";

const buildSimulationResultsReader = (resultsReader?: ResultsReader) => {
  if (!resultsReader) {
    return {
      junction: () => ({}),
      tank: () => ({}),
      reservoir: () => ({}),
      pipe: () => ({}),
      pump: () => ({}),
      valve: () => ({}),
    };
  }

  return {
    junction: (asset: Asset) => resultsReader.getJunction(asset.id) ?? {},
    tank: (asset: Asset) => resultsReader.getTank(asset.id) ?? {},
    reservoir: (asset: Asset) => resultsReader.getReservoir(asset.id) ?? {},
    pipe: (asset: Asset) => resultsReader.getPipe(asset.id) ?? {},
    pump: (asset: Asset) => resultsReader.getPump(asset.id) ?? {},
    valve: (asset: Asset) => resultsReader.getValve(asset.id) ?? {},
  };
};

const allocateBuffers = (size: number) => {
  const buffers: Record<AssetType, Uint8Array> = {
    junction: new Uint8Array(size),
    reservoir: new Uint8Array(size),
    tank: new Uint8Array(size),
    pipe: new Uint8Array(size),
    pump: new Uint8Array(size),
    valve: new Uint8Array(size),
  };
  const offsets: Record<AssetType, number> = {
    junction: 0,
    reservoir: 0,
    tank: 0,
    pipe: 0,
    pump: 0,
    valve: 0,
  };

  return { buffers, offsets };
};

const allocateProperties = () => {
  const properties: Record<AssetType, string[]> = {
    junction: [],
    reservoir: [],
    tank: [],
    pipe: [],
    pump: [],
    valve: [],
  };
  const simulationProperties: Record<AssetType, Set<string>> = {
    junction: new Set<string>(),
    reservoir: new Set<string>(),
    tank: new Set<string>(),
    pipe: new Set<string>(),
    pump: new Set<string>(),
    valve: new Set<string>(),
  };

  return { properties, simulationProperties };
};

export const exportCsv = (
  hydraulicModel: HydraulicModel,
  includeSimulationResults: boolean,
  selectedAssets: Set<number>,
  resultsReader?: ResultsReader,
): ExportedFile[] => {
  const charsPerCol = 64;
  const numCols = 64;
  const numRows = hydraulicModel.assets.size + 1;
  const size = numCols * numRows * charsPerCol;
  const parts: string[] = new Array(numCols + 1);
  const encoder = new TextEncoder();
  const hasAssetSelection = selectedAssets.size > 0;

  const getSimulationResults = buildSimulationResultsReader(resultsReader);
  const { buffers, offsets } = allocateBuffers(size);
  const { properties, simulationProperties } = allocateProperties();

  const encode = (asset: Asset) => {
    const buffer = buffers[asset.type];
    const offset = offsets[asset.type];
    const view = buffer.subarray(offset);

    const { written } = encoder.encodeInto(parts.join(","), view);
    offsets[asset.type] += written;
  };

  const writeHeader = (asset: Asset, simulationProps: string[]) => {
    parts.length = 0;
    let partIdx = 0;

    properties[asset.type] = asset.listProperties();
    simulationProperties[asset.type] = new Set<string>(
      simulationProps.map((p) => `sim_${p}`),
    );
    simulationProperties[asset.type].delete("type");

    properties[asset.type].forEach((property) => {
      parts[partIdx++] = property;
    });
    simulationProperties[asset.type].forEach((property) => {
      parts[partIdx++] = property;
    });
    parts[partIdx++] = "\n";

    encode(asset);
  };

  const writeAsset = (
    asset: Asset,
    simulationValues: Record<string, number>,
  ) => {
    parts.length = 0;
    let partIdx = 0;

    properties[asset.type].forEach((property) => {
      const value = asset.getProperty(property);
      const isObject = typeof value === "object" && value !== null;
      parts[partIdx++] = isObject ? "" : (value?.toString() ?? "");
    });

    simulationProperties[asset.type].forEach((property) => {
      const originalProperty = property.split("sim_")[1];
      parts[partIdx++] = simulationValues[originalProperty]?.toString() ?? "";
    });

    parts[partIdx++] = "\n";

    encode(asset);
  };

  hydraulicModel.assets.forEach((asset) => {
    const simulationValues = includeSimulationResults
      ? getSimulationResults[asset.type](asset)
      : {};

    if (properties[asset.type].length === 0) {
      writeHeader(asset, Object.keys(simulationValues));
    }

    if (hasAssetSelection && !selectedAssets.has(asset.id)) return;
    writeAsset(asset, simulationValues);
  });

  return Object.entries(buffers).map(([type, buffer]) => {
    const offset = offsets[type as AssetType];
    const bufferView = buffer.subarray(0, offset);

    return {
      fileName: `${type}.csv`,
      extensions: [".csv"],
      mimeTypes: ["text/csv"],
      description: "CSV File",
      blob: new Blob([bufferView], {
        type: "text/csv",
      }),
    };
  });
};
