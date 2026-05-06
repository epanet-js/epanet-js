import { Asset, AssetType, HydraulicModel } from "src/hydraulic-model";
import { ResultsReader } from "src/simulation";
import { ExportedAssetTypes, ExportedFile } from "../types";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { FILE_NAMES } from "./constants";

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
  const buffers: Record<ExportedAssetTypes, Uint8Array> = {
    junction: new Uint8Array(size),
    reservoir: new Uint8Array(size),
    tank: new Uint8Array(size),
    pipe: new Uint8Array(size),
    pump: new Uint8Array(size),
    valve: new Uint8Array(size),
    customerPoint: new Uint8Array(size),
  };
  const offsets: Record<ExportedAssetTypes, number> = {
    junction: 0,
    reservoir: 0,
    tank: 0,
    pipe: 0,
    pump: 0,
    valve: 0,
    customerPoint: 0,
  };

  return { buffers, offsets };
};

const allocateProperties = () => {
  const properties: Record<ExportedAssetTypes, string[]> = {
    junction: [],
    reservoir: [],
    tank: [],
    pipe: [],
    pump: [],
    valve: [],
    customerPoint: [],
  };
  const simulationProperties: Record<ExportedAssetTypes, Set<string>> = {
    junction: new Set<string>(),
    reservoir: new Set<string>(),
    tank: new Set<string>(),
    pipe: new Set<string>(),
    pump: new Set<string>(),
    valve: new Set<string>(),
    customerPoint: new Set<string>(),
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
  const numRows =
    Math.max(hydraulicModel.assets.size, hydraulicModel.customerPoints.size) +
    1;
  const size = numCols * numRows * charsPerCol;
  const parts: string[] = new Array(numCols + 1);
  const encoder = new TextEncoder();
  const hasAssetSelection = selectedAssets.size > 0;

  const getSimulationResults = buildSimulationResultsReader(resultsReader);
  const { buffers, offsets } = allocateBuffers(size);
  const { properties, simulationProperties } = allocateProperties();

  const encode = (type: ExportedAssetTypes) => {
    const buffer = buffers[type];
    const offset = offsets[type];
    const view = buffer.subarray(offset);

    const { written } = encoder.encodeInto(`${parts.join(",")}\n`, view);
    offsets[type] += written;
  };

  const writeHeader = (asset: Asset, simulationProps: string[]) => {
    parts.length = 0;
    let partIdx = 0;

    properties[asset.type] = asset.listProperties();
    if (asset.isNode) {
      properties[asset.type].unshift("positionX", "positionY");
    }

    simulationProperties[asset.type] = new Set<string>(
      simulationProps.map((p) => `sim_${p}`),
    );
    simulationProperties[asset.type].delete("type");

    properties[asset.type].forEach((property) => {
      if (property === "connections") {
        parts[partIdx++] = "startNode";
        parts[partIdx++] = "endNode";
      } else {
        parts[partIdx++] = property;
      }
    });

    simulationProperties[asset.type].forEach((property) => {
      parts[partIdx++] = property;
    });

    encode(asset.type);
  };

  const writeCustomerPointsHeader = () => {
    parts.length = 0;
    let partIdx = 0;

    parts[partIdx++] = "label";
    parts[partIdx++] = "x";
    parts[partIdx++] = "y";
    parts[partIdx++] = "junctionConnection";
    parts[partIdx++] = "pipeConnection";
    parts[partIdx++] = "connectionX";
    parts[partIdx++] = "connectionY";

    encode("customerPoint");
  };

  const writeCustomerPoint = (point: CustomerPoint) => {
    parts.length = 0;
    let partIdx = 0;

    const junctionConnection =
      point.connection !== null
        ? (hydraulicModel.assets.get(point.connection.junctionId)?.label ?? "")
        : "";
    const pipeConnection =
      point.connection !== null
        ? (hydraulicModel.assets.get(point.connection.pipeId)?.label ?? "")
        : "";

    parts[partIdx++] = point.label;
    parts[partIdx++] = point.coordinates[0]?.toFixed(4) ?? "";
    parts[partIdx++] = point.coordinates[1]?.toFixed(4) ?? "";
    parts[partIdx++] = junctionConnection;
    parts[partIdx++] = pipeConnection;
    parts[partIdx++] = Number(point.connection?.snapPoint[0])?.toFixed(4) ?? "";
    parts[partIdx++] = Number(point.connection?.snapPoint[1])?.toFixed(4) ?? "";

    encode("customerPoint");
  };

  const writeAsset = (
    asset: Asset,
    simulationValues: Record<string, number>,
  ) => {
    parts.length = 0;
    let partIdx = 0;

    const truncateIfNumber = (
      field: string | number | boolean | null | undefined,
    ) => {
      if (field === undefined || field === null) return "";
      if (typeof field === "number") {
        if (Math.trunc(field) === field) return field.toString();
        return field.toFixed(4);
      }
      if (typeof field !== "string") return field.toString();

      const asNumber = Number(field);
      if (Number.isNaN(asNumber)) return field;

      if (Math.trunc(asNumber) === asNumber) return field;
      return asNumber.toFixed(4);
    };

    const formatConnections = (connections: number[]) => {
      const startAsset = hydraulicModel.assets.get(
        (connections as unknown as number[])[0],
      );
      const endAsset = hydraulicModel.assets.get(
        (connections as unknown as number[])[1],
      );

      const startNode = startAsset?.label ?? "";
      const endNode = endAsset?.label ?? "";

      return { startNode, endNode };
    };

    const getPosition = (asset: Asset, property: string) => {
      if (!asset.isNode) return "";
      const x = asset.coordinates[0] as number;
      const y = asset.coordinates[1] as number;

      return property === "positionX" ? x.toFixed(4) : y.toFixed(4);
    };

    properties[asset.type].forEach((property) => {
      const isPosition = property === "positionX" || property === "positionY";
      const isConnections = property === "connections";

      const value = isPosition
        ? getPosition(asset, property)
        : asset.getProperty(property);

      const isObject = typeof value === "object";

      if (!isConnections) {
        const formatted = truncateIfNumber(value);
        parts[partIdx++] = isObject ? "" : formatted;
      } else {
        const { startNode, endNode } = formatConnections(
          value as unknown as number[],
        );

        parts[partIdx++] = startNode;
        parts[partIdx++] = endNode;
      }
    });

    simulationProperties[asset.type].forEach((property) => {
      const originalProperty = property.split("sim_")[1];
      const value = simulationValues[originalProperty];
      const formatted = truncateIfNumber(value);
      parts[partIdx++] = formatted;
    });

    encode(asset.type);
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

  writeCustomerPointsHeader();

  hydraulicModel.customerPoints.forEach((point) => writeCustomerPoint(point));

  return Object.entries(buffers).map(([t, buffer]) => {
    const type = t as ExportedAssetTypes;
    const offset = offsets[type];
    const bufferView = buffer.subarray(0, offset);

    return {
      fileName: `${FILE_NAMES[type]}.csv`,
      extensions: [".csv"],
      mimeTypes: ["text/csv"],
      description: "CSV File",
      blob: new Blob([bufferView], {
        type: "text/csv",
      }),
    };
  });
};
