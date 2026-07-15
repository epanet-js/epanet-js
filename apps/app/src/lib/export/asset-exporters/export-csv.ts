import { TranslateFn } from "@epanet-js/i18n";
import { Asset, HydraulicModel, Projection } from "src/hydraulic-model";
import { ResultsReader } from "src/simulation";
import { AssetExportOptions, ExportedAssetTypes, ExportedFile } from "../types";
import { CustomerPoint } from "@epanet-js/hydraulic-model";
import { FILE_NAMES } from "./constants";
import { NUM_DECIMAL_PLACES, COORDINATE_DECIMAL_PLACES } from "../constants";
import { createProjectionMapper } from "src/lib/projections";
import { resolveExportValue } from "./optional-field-defaults";
import { exportableProperties } from "./excluded-fields";
import { buildPropertyNameResolver } from "./property-names";
import { Position } from "geojson";

export const exportCsv = (
  hydraulicModel: HydraulicModel,
  projection: Projection,
  translate: TranslateFn,
  options?: AssetExportOptions,
): ExportedFile[] => {
  const includeSimulationResults =
    (options?.includeSimulationResults ?? false) && !!options?.resultsReader;
  const selectedAssets = options?.assetIdsFilter ?? null;
  const selectedCustomerPoints = options?.customerPointIdFilter ?? null;
  const resultsReader = options?.resultsReader;
  const charsPerCol = 64;
  const numCols = 64;
  const numRows =
    Math.max(hydraulicModel.assets.size, hydraulicModel.customerPoints.size) +
    1;
  const size = numCols * numRows * charsPerCol;
  const parts: string[] = new Array(numCols + 1);
  const encoder = new TextEncoder();

  const transformCoord = createProjectionMapper(projection).toSource;
  const getSimulationResults = buildSimulationResultsReader(resultsReader);
  const { buffers, offsets } = allocateBuffers(size);
  const { properties, simulationProperties } = allocateProperties();
  const resolvePropertyName = buildPropertyNameResolver(
    hydraulicModel.customAttributes,
    translate,
  );
  const headerName = (type: ExportedAssetTypes, property: string) =>
    escapeCsvField(resolvePropertyName(type, property));

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

    properties[asset.type] = exportableProperties(
      asset.type,
      asset.listProperties(),
    );
    if (asset.isNode) {
      properties[asset.type].unshift("positionX", "positionY");
    }

    simulationProperties[asset.type] = new Set<string>(
      simulationProps.map((p) => `sim_${p}`),
    );
    simulationProperties[asset.type].delete("type");

    properties[asset.type].forEach((property) => {
      if (property === "connections") {
        parts[partIdx++] = headerName(asset.type, "startNode");
        parts[partIdx++] = headerName(asset.type, "endNode");
      } else {
        parts[partIdx++] = headerName(asset.type, property);
      }
    });

    simulationProperties[asset.type].forEach((property) => {
      parts[partIdx++] = headerName(asset.type, property);
    });

    encode(asset.type);
  };

  const writeCustomerPointsHeader = () => {
    parts.length = 0;
    let partIdx = 0;

    parts[partIdx++] = headerName("customerPoint", "label");
    parts[partIdx++] = headerName("customerPoint", "positionX");
    parts[partIdx++] = headerName("customerPoint", "positionY");
    parts[partIdx++] = headerName("customerPoint", "junctionConnection");
    parts[partIdx++] = headerName("customerPoint", "pipeConnection");
    parts[partIdx++] = headerName("customerPoint", "connectionX");
    parts[partIdx++] = headerName("customerPoint", "connectionY");

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

    const [x, y] = transformCoord(point.coordinates);
    const snapPoint = point.connection?.snapPoint;
    const [sx, sy] = snapPoint ? transformCoord(snapPoint) : [null, null];

    parts[partIdx++] = point.label;
    parts[partIdx++] = x.toFixed(COORDINATE_DECIMAL_PLACES);
    parts[partIdx++] = y.toFixed(COORDINATE_DECIMAL_PLACES);
    parts[partIdx++] = junctionConnection;
    parts[partIdx++] = pipeConnection;
    parts[partIdx++] = sx !== null ? sx.toFixed(COORDINATE_DECIMAL_PLACES) : "";
    parts[partIdx++] = sy !== null ? sy.toFixed(COORDINATE_DECIMAL_PLACES) : "";

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
        return field.toFixed(NUM_DECIMAL_PLACES);
      }
      if (typeof field !== "string") return field.toString();

      const asNumber = Number(field);
      if (Number.isNaN(asNumber)) return field;

      if (Math.trunc(asNumber) === asNumber) return field;
      return asNumber.toFixed(NUM_DECIMAL_PLACES);
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
      const [x, y] = transformCoord(asset.coordinates as Position);
      return property === "positionX"
        ? x.toFixed(COORDINATE_DECIMAL_PLACES)
        : y.toFixed(COORDINATE_DECIMAL_PLACES);
    };

    properties[asset.type].forEach((property) => {
      const isPosition = property === "positionX" || property === "positionY";
      const isConnections = property === "connections";

      const value = isPosition
        ? getPosition(asset, property)
        : resolveExportValue(asset.type, property, asset.getProperty(property));

      const isObject = typeof value === "object";

      if (!isConnections) {
        const formatted = isPosition
          ? (value as string)
          : truncateIfNumber(value);
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

    if (selectedAssets && !selectedAssets.has(asset.id)) return;
    writeAsset(asset, simulationValues);
  });

  if (hydraulicModel.customerPoints.size > 0) {
    writeCustomerPointsHeader();
    hydraulicModel.customerPoints.forEach((point) => {
      if (selectedCustomerPoints && !selectedCustomerPoints.has(point.id))
        return;
      writeCustomerPoint(point);
    });
  }

  return Object.entries(buffers)
    .filter(([t]) => offsets[t as ExportedAssetTypes] > 0)
    .map(([t, buffer]) => {
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

const escapeCsvField = (value: string): string =>
  /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

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
