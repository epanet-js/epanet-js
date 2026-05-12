import {
  Asset,
  AssetType,
  HydraulicModel,
  Projection,
} from "src/hydraulic-model";
import { ExportedAssetTypes, ExportedFile } from "../types";
import { ResultsReader } from "src/simulation";
import { Feature, Position } from "geojson";
import { FILE_NAMES } from "./constants";
import { NUM_DECIMAL_PLACES, COORDINATE_DECIMAL_PLACES } from "../constants";
import { createProjectionMapper } from "src/lib/projections";

const GEOJSON_END = `]}`;

const buildCrs = (projection: Projection): string => {
  switch (projection.type) {
    case "wgs84":
      return '{"type":"name","properties":{"name":"urn:ogc:def:crs:OGC:1.3:CRS84"}}';
    case "proj4":
      return `{"type":"name","properties":{"name":${JSON.stringify(projection.code)}}}`;
    case "xy-grid":
      return `{"type":"name","properties":{"name":${JSON.stringify(projection.id)}}}`;
  }
};

const buildGeoJsonHeader = (projection: Projection): string =>
  `{"type":"FeatureCollection","crs":${buildCrs(projection)},"features":[`;

export const exportGeoJson = (
  hydraulicModel: HydraulicModel,
  includeSimulationResults: boolean,
  selectedAssets: Set<number>,
  projection: Projection,
  resultsReader?: ResultsReader,
): ExportedFile[] => {
  const entrySize = estimateEntrySize(hydraulicModel);
  const size =
    Math.max(hydraulicModel.assets.size, hydraulicModel.customerPoints.size) *
      2 *
      entrySize +
    1024;
  const encoder = new TextEncoder();
  const transformCoord = createProjectionMapper(projection).toSource;
  const getSimulationResults = buildSimulationResultsReader(resultsReader);
  const { buffers, offsets } = allocateBuffers(size);
  const hasAssetSelection = selectedAssets.size > 0;
  const header = buildGeoJsonHeader(projection);

  encodeHeader(buffers, offsets, encoder, header);

  hydraulicModel.assets.forEach((asset) => {
    if (hasAssetSelection && !selectedAssets.has(asset.id)) return;

    const simulationValues = includeSimulationResults
      ? getSimulationResults[asset.type](asset)
      : {};
    const buffer = buffers[asset.type];
    const offset = offsets[asset.type];
    const view = buffer.subarray(offset);
    const geoJson = assetToGeoJson(
      hydraulicModel,
      asset,
      simulationValues,
      transformCoord,
    );

    const textContent = `${geoJson},`;
    const { written } = encoder.encodeInto(textContent, view);
    offsets[asset.type] += written;
  });

  hydraulicModel.customerPoints.forEach((point) => {
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
    const [cx, cy] = snapPoint
      ? transformCoord(snapPoint)
      : [undefined, undefined];
    const mapped = {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [
          Number(x.toFixed(COORDINATE_DECIMAL_PLACES)),
          Number(y.toFixed(COORDINATE_DECIMAL_PLACES)),
        ],
      },
      properties: {
        label: point.label,
        junctionConnection,
        pipeConnection,
        connectionX:
          cx !== undefined
            ? Number(cx.toFixed(COORDINATE_DECIMAL_PLACES))
            : undefined,
        connectionY:
          cy !== undefined
            ? Number(cy.toFixed(COORDINATE_DECIMAL_PLACES))
            : undefined,
      },
    };

    const buffer = buffers["customerPoint"];
    const offset = offsets["customerPoint"];
    const view = buffer.subarray(offset);

    const { written } = encoder.encodeInto(`${JSON.stringify(mapped)},`, view);
    offsets["customerPoint"] += written;
  });

  removeTrailingComma(buffers, offsets, header.length);
  encodeEnd(buffers, offsets, encoder);

  return Object.entries(buffers).map(([t, buffer]) => {
    const type = t as ExportedAssetTypes;
    const offset = offsets[type];
    const bufferView = buffer.subarray(0, offset);

    return {
      fileName: `${FILE_NAMES[type]}.geojson`,
      extensions: [".geojson"],
      mimeTypes: ["text/geo+json"],
      description: "GeoJSON File",
      blob: new Blob([bufferView], {
        type: "text/geo+json",
      }),
    };
  });
};

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

const prefixSimulationKeys = (simulationResults: Record<string, unknown>) => {
  const prefixed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(simulationResults)) {
    if (key !== "type") prefixed[`sim_${key}`] = value;
  }
  return prefixed;
};

const assetToGeoJson = (
  hydraulicModel: HydraulicModel,
  asset: Asset,
  simulationResults: Record<string, unknown> = {},
  transformCoord: (p: Position) => Position = (p) => p,
) => {
  const buildConnection = (connection: number) => {
    const asset = hydraulicModel.assets.get(connection);
    return asset?.label;
  };

  const replacer = function (
    this: unknown,
    _: string,
    value: string | number | boolean | object | null,
  ) {
    if (value === null) return undefined;
    if (typeof value !== "number") return value;
    if (Math.trunc(value) === value) return value;

    const precision = Array.isArray(this)
      ? COORDINATE_DECIMAL_PLACES
      : NUM_DECIMAL_PLACES;
    return Number(value.toFixed(precision));
  };

  const geometry = asset?.feature.geometry;
  const transformedGeometry =
    geometry?.type === "Point"
      ? {
          ...geometry,
          coordinates: transformCoord(geometry.coordinates),
        }
      : {
          ...geometry,
          coordinates: geometry.coordinates.map(transformCoord),
        };

  const mapped: Feature = {
    type: "Feature",
    geometry: transformedGeometry as Feature["geometry"],
    properties: {
      ...asset?.feature.properties,
      ...prefixSimulationKeys(simulationResults),
    },
  };

  if (
    "properties" in mapped &&
    mapped.properties !== null &&
    "connections" in (mapped.properties as object)
  ) {
    const [start, end] = mapped.properties?.connections as number[];
    delete mapped.properties["connections"];
    mapped.properties["startNode"] = buildConnection(start);
    mapped.properties["endNode"] = buildConnection(end);
  }

  return JSON.stringify(mapped, replacer);
};

const estimateEntrySize = (hydraulicModel: HydraulicModel) => {
  const asset = hydraulicModel.assets.values().next().value;
  if (!asset) return 0;
  return assetToGeoJson(hydraulicModel, asset).length;
};

const encodeHeader = (
  buffers: Record<AssetType, Uint8Array>,
  offsets: Record<AssetType, number>,
  textEncoder: TextEncoder,
  header: string,
) => {
  const types = Object.keys(buffers) as AssetType[];
  types.forEach((type) => {
    const buffer = buffers[type];
    const { written } = textEncoder.encodeInto(header, buffer);
    offsets[type] += written;
  });
};

const encodeEnd = (
  buffers: Record<ExportedAssetTypes, Uint8Array>,
  offsets: Record<ExportedAssetTypes, number>,
  textEncoder: TextEncoder,
) => {
  const types = Object.keys(buffers) as ExportedAssetTypes[];
  types.forEach((type) => {
    const buffer = buffers[type];
    const offset = offsets[type];
    const view = buffer.subarray(offset);
    const { written } = textEncoder.encodeInto(GEOJSON_END, view);
    offsets[type] += written;
  });
};

const removeTrailingComma = (
  buffers: Record<ExportedAssetTypes, Uint8Array>,
  offsets: Record<ExportedAssetTypes, number>,
  headerLength: number,
) => {
  const types = Object.keys(buffers) as ExportedAssetTypes[];

  types.forEach((type) => {
    if (offsets[type] > headerLength) {
      offsets[type] -= 1;
    }
  });
};
