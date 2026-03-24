import * as Comlink from "comlink";
import { canUseWorker } from "src/infra/worker";
import type { BoundaryWorkerAPI } from "./compute-boundary-worker-api";
import { boundaryWorkerAPI } from "./compute-boundary-worker-api";
import type { GeoTiffTile } from "./elevation-source-types";

export type BoundaryResult = {
  tileId: string;
  polygon: GeoJSON.Geometry | null;
};

/**
 * Computes data boundaries for multiple tiles using a single worker.
 * Calls `onResult` after each tile completes.
 * Checks `isCancelled` before and after each computation to skip cancelled tiles.
 */
export async function computeTileBoundaries(
  tiles: GeoTiffTile[],
  onResult: (result: BoundaryResult) => void,
  isCancelled: (tileId: string) => boolean,
): Promise<void> {
  if (canUseWorker()) {
    return runBatchWithWorker(tiles, onResult, isCancelled);
  }

  for (const tile of tiles) {
    if (isCancelled(tile.id)) continue;

    const polygon = await boundaryWorkerAPI.computeDataBoundary(
      tile.file,
      tile.width,
      tile.height,
      tile.noDataValue,
      tile.pixelToGps,
    );

    if (isCancelled(tile.id)) continue;
    onResult({ tileId: tile.id, polygon });
  }
}

async function runBatchWithWorker(
  tiles: GeoTiffTile[],
  onResult: (result: BoundaryResult) => void,
  isCancelled: (tileId: string) => boolean,
): Promise<void> {
  const worker = new Worker(
    new URL("./compute-boundary-worker.ts", import.meta.url),
    { type: "module" },
  );
  const api = Comlink.wrap<BoundaryWorkerAPI>(worker);

  try {
    for (const tile of tiles) {
      if (isCancelled(tile.id)) continue;

      const polygon = await api.computeDataBoundary(
        tile.file,
        tile.width,
        tile.height,
        tile.noDataValue,
        tile.pixelToGps,
      );

      if (isCancelled(tile.id)) continue;
      onResult({ tileId: tile.id, polygon });
    }
  } finally {
    worker.terminate();
  }
}
