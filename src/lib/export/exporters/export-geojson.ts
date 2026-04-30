import { Asset, AssetType, HydraulicModel } from "src/hydraulic-model";
import { ExportedFile } from "../types";
import { ResultsReader } from "src/simulation";

const GEOJSON_HEADER = `{"type":"FeatureCollection","features":[`;
const GEOJSON_END = `]}`;

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
  const buffers: Record<AssetType, Uint8Array<ArrayBuffer>> = {
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

const assetToGeoJson = (asset: Asset) => {
  const mapped = {
    type: "Feature",
    geometry: asset?.feature.geometry,
    properties: asset?.feature.properties,
  };
  return JSON.stringify(mapped);
};

const estimateEntrySize = (hydraulicModel: HydraulicModel) => {
  const asset = hydraulicModel.assets.values().next().value;
  if (!asset) return 0;
  return assetToGeoJson(asset).length;
};

const encodeHeader = (
  buffers: Record<AssetType, Uint8Array<ArrayBuffer>>,
  offsets: Record<AssetType, number>,
  textEncoder: TextEncoder,
) => {
  const types = Object.keys(buffers) as AssetType[];
  types.forEach((type) => {
    const buffer = buffers[type];
    const { written } = textEncoder.encodeInto(GEOJSON_HEADER, buffer);
    offsets[type] += written;
  });
};

const encodeEnd = (
  buffers: Record<AssetType, Uint8Array<ArrayBuffer>>,
  offsets: Record<AssetType, number>,
  textEncoder: TextEncoder,
) => {
  const types = Object.keys(buffers) as AssetType[];
  types.forEach((type) => {
    const buffer = buffers[type];
    const offset = offsets[type];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const view = buffer.subarray(offset);
    const { written } = textEncoder.encodeInto(GEOJSON_END, view);
    offsets[type] += written;
  });
};

const removeTrailingComma = (
  buffers: Record<AssetType, Uint8Array<ArrayBuffer>>,
  offsets: Record<AssetType, number>,
) => {
  const types = Object.keys(buffers) as AssetType[];
  types.forEach((type) => {
    if (offsets[type] > GEOJSON_HEADER.length) {
      offsets[type] -= 1;
    }
  });
};

export const exportGeoJson = (
  hydraulicModel: HydraulicModel,
  _includeSimulationResults: boolean,
  _resultsReader?: ResultsReader,
): ExportedFile[] => {
  const entrySize = estimateEntrySize(hydraulicModel);
  const size = hydraulicModel.assets.size * 2 * entrySize + 1024;
  const encoder = new TextEncoder();
  const { buffers, offsets } = allocateBuffers(size);

  encodeHeader(buffers, offsets, encoder);

  hydraulicModel.assets.forEach((asset) => {
    const buffer = buffers[asset.type];
    const offset = offsets[asset.type];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const view = buffer.subarray(offset);
    const geoJson = assetToGeoJson(asset);

    const textContent = `${geoJson},`;
    const { written } = encoder.encodeInto(textContent, view);
    offsets[asset.type] += written;
  });

  removeTrailingComma(buffers, offsets);
  encodeEnd(buffers, offsets, encoder);

  return Object.entries(buffers).map(([type, buffer]) => {
    const offset = offsets[type as AssetType];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const bufferView = buffer.subarray(0, offset);

    return {
      fileName: `${type}.geojson`,
      extensions: [".geojson"],
      mimeTypes: ["text/geo+json"],
      description: "GeoJSON File",
      blob: new Blob([bufferView], {
        type: "text/geo+json",
      }),
    };
  });
};
