import {
  type Asset,
  type AssetType,
  type HydraulicModel,
} from "src/hydraulic-model";
import { type ResultsReader } from "src/simulation";
import { type ExportedFile } from "../../types";
import { SHAPE_POINT, SHAPE_POLYLINE, PRJ_BYTES, CPG_BYTES } from "./constants";
import { AssetWriter } from "./asset-writer";
import { ensureField, inferFieldType, freezeSchema } from "./schema";
import { writePoint, writePolyLine } from "./geometry-writer";
import { writeDbfHeader, writeDbfRecord } from "./dbf-writer";
import { writeShpHeader, writeShxHeader, patchBbox } from "./shp-header";

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

export const exportShapefiles = (
  hydraulicModel: HydraulicModel,
  includeSimulationResults: boolean,
  selectedAssets: Set<number>,
  resultsReader?: ResultsReader,
): ExportedFile[] => {
  const writers: Record<AssetType, AssetWriter> = {
    junction: new AssetWriter(SHAPE_POINT),
    reservoir: new AssetWriter(SHAPE_POINT),
    tank: new AssetWriter(SHAPE_POINT),
    pipe: new AssetWriter(SHAPE_POLYLINE),
    pump: new AssetWriter(SHAPE_POLYLINE),
    valve: new AssetWriter(SHAPE_POLYLINE),
  };

  const encoder = new TextEncoder();
  const scratch = new Uint8Array(1024);
  const hasSelection = selectedAssets.size > 0;
  const getSimResults = buildSimulationResultsReader(resultsReader);

  // ── Pass 1: measure ───────────────────────────────────────────────────────
  for (const asset of hydraulicModel.assets.values()) {
    if (hasSelection && !selectedAssets.has(asset.id)) continue;

    const w = writers[asset.type];
    w.recordCount++;

    if (w.shapeType === SHAPE_POINT) {
      w.shpBodyBytes += 28;
    } else {
      const coords = asset.feature.geometry.coordinates as number[][];
      w.shpBodyBytes += 56 + 16 * coords.length;
    }

    const props = asset.feature.properties as Record<string, unknown>;
    for (const key in props) {
      if (key === "type") continue;
      const info = ensureField(w.fields, key);
      inferFieldType(info, props[key], scratch, encoder);
    }

    if (includeSimulationResults) {
      const simValues = getSimResults[asset.type](asset) as Record<
        string,
        unknown
      >;
      for (const key in simValues) {
        const info = ensureField(w.fields, key);
        inferFieldType(info, simValues[key], scratch, encoder);
      }
    }
  }

  // ── Between passes: freeze schemas, allocate, write headers ──────────────
  for (const type in writers) {
    const w = writers[type as AssetType];
    if (w.recordCount === 0) continue;

    w.frozenSchema = freezeSchema(w.fields, encoder);
    w.allocate();
    writeShpHeader(w);
    writeShxHeader(w);
    writeDbfHeader(w);
  }

  const formatConnections = (props: { connections: number[] | string }) => {
    const [firstId, secondId] = props.connections as number[];
    const first = hydraulicModel.assets.get(firstId);
    const second = hydraulicModel.assets.get(secondId);

    if (first === undefined && second === undefined) return;
    if (first === undefined) {
      props.connections = `${second?.label}`;
      return;
    }
    if (second === undefined) {
      props.connections = `${first?.label}`;
      return;
    }

    props.connections = `${first?.label},${second?.label}`;
  };

  // ── Pass 2: write ─────────────────────────────────────────────────────────
  for (const asset of hydraulicModel.assets.values()) {
    if (hasSelection && !selectedAssets.has(asset.id)) continue;

    const w = writers[asset.type];
    const recIdx = w.nextRecordIndex();
    const shxOffsetWords = w.shpCursor / 2;
    let contentLengthWords: number;

    if (w.shapeType === SHAPE_POINT) {
      const coords = asset.feature.geometry.coordinates as number[];
      writePoint(w, coords, recIdx);
      contentLengthWords = 10;
    } else {
      const coords = asset.feature.geometry.coordinates as number[][];
      writePolyLine(w, coords, recIdx);
      contentLengthWords = 24 + 8 * coords.length;
    }

    // SHX entry
    w.shxView.setUint32(w.shxCursor, shxOffsetWords, false);
    w.shxView.setUint32(w.shxCursor + 4, contentLengthWords, false);
    w.shxCursor += 8;

    // DBF record
    const props = { ...asset.feature.properties } as Record<string, unknown>;
    if ("connections" in props) {
      formatConnections(props as { connections: number[] | string });
    }
    const simValues = includeSimulationResults
      ? (getSimResults[asset.type](asset) as Record<string, unknown>)
      : ({} as Record<string, unknown>);
    writeDbfRecord(w, props, simValues, encoder);
  }

  // ── Post-pass: patch bboxes, write DBF EOF ────────────────────────────────
  for (const type in writers) {
    const w = writers[type as AssetType];
    if (w.recordCount === 0) continue;

    patchBbox(w);
    w.dbf[w.dbf.length - 1] = 0x1a; // EOF marker
  }

  // ── Build result ──────────────────────────────────────────────────────────
  const result: ExportedFile[] = [];

  for (const type in writers) {
    const w = writers[type as AssetType];
    if (w.recordCount === 0) continue;

    result.push({
      fileName: `${type}.shp`,
      extensions: [".shp"],
      mimeTypes: ["application/octet-stream"],
      description: "Shapefile",
      blob: new Blob([w.shp]),
    });
    result.push({
      fileName: `${type}.shx`,
      extensions: [".shx"],
      mimeTypes: ["application/octet-stream"],
      description: "Shapefile Index",
      blob: new Blob([w.shx]),
    });
    result.push({
      fileName: `${type}.dbf`,
      extensions: [".dbf"],
      mimeTypes: ["application/octet-stream"],
      description: "Shapefile Attributes",
      blob: new Blob([w.dbf]),
    });
    result.push({
      fileName: `${type}.prj`,
      extensions: [".prj"],
      mimeTypes: ["text/plain"],
      description: "Shapefile Projection",
      blob: new Blob([PRJ_BYTES]),
    });
    result.push({
      fileName: `${type}.cpg`,
      extensions: [".cpg"],
      mimeTypes: ["text/plain"],
      description: "Shapefile Code Page",
      blob: new Blob([CPG_BYTES]),
    });
  }

  return result;
};
