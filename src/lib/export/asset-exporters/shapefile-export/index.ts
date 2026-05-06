import { type Asset, type HydraulicModel } from "src/hydraulic-model";
import { type ResultsReader } from "src/simulation";
import { type ExportedAssetTypes, type ExportedFile } from "../../types";
import { SHAPE_POINT, SHAPE_POLYLINE, PRJ_BYTES, CPG_BYTES } from "./constants";
import { AssetWriter } from "./asset-writer";
import { buildSchema } from "./schema";
import { writePoint, writePolyLine } from "./geometry-writer";
import { writeDbfHeader, writeDbfRecord } from "./dbf-writer";
import { writeShpHeader, writeShxHeader, patchBbox } from "./shp-header";
import { FILE_NAMES } from "../constants";

const CUSTOMER_POINT_FIELDS = [
  "label",
  "positionX",
  "positionY",
  "junctionConnection",
  "pipeConnection",
  "connectionX",
  "connectionY",
] as const;

export const exportShapefiles = (
  hydraulicModel: HydraulicModel,
  includeSimulationResults: boolean,
  selectedAssets: Set<number>,
  resultsReader?: ResultsReader,
): ExportedFile[] => {
  const writers: Record<ExportedAssetTypes, AssetWriter> = {
    junction: new AssetWriter(SHAPE_POINT),
    reservoir: new AssetWriter(SHAPE_POINT),
    tank: new AssetWriter(SHAPE_POINT),
    pipe: new AssetWriter(SHAPE_POLYLINE),
    pump: new AssetWriter(SHAPE_POLYLINE),
    valve: new AssetWriter(SHAPE_POLYLINE),
    customerPoint: new AssetWriter(SHAPE_POINT),
  };

  const encoder = new TextEncoder();
  const hasSelection = selectedAssets.size > 0;
  const getSimResults = buildSimulationResultsReader(resultsReader);
  const seenFields: Record<ExportedAssetTypes, Set<string>> = {
    junction: new Set(),
    reservoir: new Set(),
    tank: new Set(),
    pipe: new Set(),
    pump: new Set(),
    valve: new Set(),
    customerPoint: new Set(CUSTOMER_POINT_FIELDS),
  };

  for (const asset of hydraulicModel.assets.values()) {
    if (hasSelection && !selectedAssets.has(asset.id)) continue;

    const writer = writers[asset.type];
    writer.recordCount++;

    if (writer.shapeType === SHAPE_POINT) {
      writer.shpBodyBytes += 28;
    } else {
      const coords = asset.feature.geometry.coordinates as number[][];
      writer.shpBodyBytes += 56 + 16 * coords.length;
    }

    const props = asset.feature.properties as Record<string, unknown>;
    for (const key in props) {
      if (key === "type") continue;
      if (key === "connections") {
        seenFields[asset.type].add("startNode");
        seenFields[asset.type].add("endNode");
        continue;
      }
      seenFields[asset.type].add(key);
    }

    if (includeSimulationResults) {
      const simValues = getSimResults[asset.type](asset) as Record<
        string,
        unknown
      >;
      for (const key in simValues) {
        seenFields[asset.type].add(key);
      }
    }
  }

  writers["customerPoint"].recordCount = hydraulicModel.customerPoints.size;
  writers["customerPoint"].shpBodyBytes =
    28 * hydraulicModel.customerPoints.size;

  for (const type in writers) {
    const t = type as ExportedAssetTypes;
    const writer = writers[t];
    if (writer.recordCount === 0) continue;

    writer.frozenSchema = buildSchema(seenFields[t], encoder);
    writer.allocate();
    writeShpHeader(writer);
    writeShxHeader(writer);
    writeDbfHeader(writer);
  }

  for (const asset of hydraulicModel.assets.values()) {
    if (hasSelection && !selectedAssets.has(asset.id)) continue;

    const writer = writers[asset.type];
    const recordIndex = writer.nextRecordIndex();
    const shxOffsetWords = writer.shpCursor / 2;
    let contentLengthWords: number;

    if (writer.shapeType === SHAPE_POINT) {
      const coords = asset.feature.geometry.coordinates as number[];
      writePoint(writer, coords, recordIndex);
      contentLengthWords = 10;
    } else {
      const coords = asset.feature.geometry.coordinates as number[][];
      writePolyLine(writer, coords, recordIndex);
      contentLengthWords = 24 + 8 * coords.length;
    }

    writer.shxView.setUint32(writer.shxCursor, shxOffsetWords, false);
    writer.shxView.setUint32(writer.shxCursor + 4, contentLengthWords, false);
    writer.shxCursor += 8;

    const props = { ...asset.feature.properties } as Record<string, unknown>;
    if ("connections" in props) {
      const [firstId, secondId] = props.connections as number[];
      props.startNode = hydraulicModel.assets.get(firstId)?.label ?? "";
      props.endNode = hydraulicModel.assets.get(secondId)?.label ?? "";
      delete props.connections;
    }
    const simValues = includeSimulationResults
      ? (getSimResults[asset.type](asset) as Record<string, unknown>)
      : ({} as Record<string, unknown>);
    writeDbfRecord(writer, props, simValues, encoder);
  }

  const customerPointWriter = writers["customerPoint"];
  for (const point of hydraulicModel.customerPoints.values()) {
    const recordIndex = customerPointWriter.nextRecordIndex();
    const shxOffsetWords = customerPointWriter.shpCursor / 2;

    writePoint(customerPointWriter, point.coordinates, recordIndex);

    customerPointWriter.shxView.setUint32(
      customerPointWriter.shxCursor,
      shxOffsetWords,
      false,
    );
    customerPointWriter.shxView.setUint32(
      customerPointWriter.shxCursor + 4,
      10,
      false,
    );
    customerPointWriter.shxCursor += 8;

    const junctionConnection =
      point.connection !== null
        ? (hydraulicModel.assets.get(point.connection.junctionId)?.label ?? "")
        : "";
    const pipeConnection =
      point.connection !== null
        ? (hydraulicModel.assets.get(point.connection.pipeId)?.label ?? "")
        : "";

    writeDbfRecord(
      customerPointWriter,
      {
        label: point.label,
        positionX: point.coordinates[0],
        positionY: point.coordinates[1],
        junctionConnection,
        pipeConnection,
        connectionX: point.connection?.snapPoint[0] ?? null,
        connectionY: point.connection?.snapPoint[1] ?? null,
      },
      {},
      encoder,
    );
  }

  for (const type in writers) {
    const writer = writers[type as ExportedAssetTypes];
    if (writer.recordCount === 0) continue;

    patchBbox(writer);
    writer.dbf[writer.dbf.length - 1] = 0x1a;
  }

  const result: ExportedFile[] = [];

  for (const t in writers) {
    const type = t as ExportedAssetTypes;
    const writer = writers[type];
    if (writer.recordCount === 0) continue;
    const fileName = FILE_NAMES[type];

    result.push({
      fileName: `${fileName}.shp`,
      extensions: [".shp"],
      mimeTypes: ["application/octet-stream"],
      description: "Shapefile",
      blob: new Blob([writer.shp]),
    });
    result.push({
      fileName: `${fileName}.shx`,
      extensions: [".shx"],
      mimeTypes: ["application/octet-stream"],
      description: "Shapefile Index",
      blob: new Blob([writer.shx]),
    });
    result.push({
      fileName: `${fileName}.dbf`,
      extensions: [".dbf"],
      mimeTypes: ["application/octet-stream"],
      description: "Shapefile Attributes",
      blob: new Blob([writer.dbf]),
    });
    result.push({
      fileName: `${fileName}.prj`,
      extensions: [".prj"],
      mimeTypes: ["text/plain"],
      description: "Shapefile Projection",
      blob: new Blob([PRJ_BYTES]),
    });
    result.push({
      fileName: `${fileName}.cpg`,
      extensions: [".cpg"],
      mimeTypes: ["text/plain"],
      description: "Shapefile Code Page",
      blob: new Blob([CPG_BYTES]),
    });
  }

  return result;
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
