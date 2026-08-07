import {
  type CanvasSetupFn,
  type LngLat,
  type TileServerConfig,
  browserCanvasSetup,
  queryClient,
  fetchTileFromUrl,
  readElevationFromPixels,
  resolveTileServerConfig,
  lngLatToTile,
  setTileFetchInstrument,
} from "@epanet-js/elevations";
import { withDebugInstrumentation } from "src/infra/with-instrumentation";
import { Unit } from "@epanet-js/quantity";

setTileFetchInstrument((fetchTile) =>
  withDebugInstrumentation(fetchTile, {
    name: "FETCH_ELEVATION:FETCH_TILE",
    maxDurationMs: 500,
    maxCalls: 7,
    callsIntervalMs: 1000,
  }),
);

const TILE_FETCH_CONCURRENCY = 12;

export async function fetchElevationsForPoints(
  points: LngLat[],
  {
    unit,
    tileServer,
    setUpCanvas = browserCanvasSetup,
    onResolved,
    onTileProgress,
    signal,
    concurrency = TILE_FETCH_CONCURRENCY,
  }: {
    unit: Unit;
    tileServer?: TileServerConfig;
    setUpCanvas?: CanvasSetupFn;
    onResolved?: (count: number) => void;
    onTileProgress?: (completed: number, total: number) => void;
    signal?: AbortSignal;
    concurrency?: number;
  },
): Promise<(number | null)[]> {
  const config = resolveTileServerConfig(tileServer);
  const tileGroups = groupPointsByTile(points, config.tileZoom);
  const results: (number | null)[] = points.map(() => null);

  let tilesCompleted = 0;
  await runWithConcurrency(tileGroups, concurrency, signal, async (group) => {
    const pixels = await fetchAndDecodeTilePixels(
      group.tileX,
      group.tileY,
      config,
      setUpCanvas,
    );
    if (pixels) {
      for (const { index, point } of group.entries) {
        results[index] = readElevationFromPixels(pixels, point, config, unit);
      }
    }
    // A failed tile resolves nothing; those points stay null (reported as
    // unresolved). A decoded tile resolves all its points.
    onResolved?.(pixels ? group.entries.length : 0);
    tilesCompleted += 1;
    onTileProgress?.(tilesCompleted, tileGroups.length);
  });

  return results;
}

/**
 * Runs `worker` over `items` with at most `limit` in flight at once, via a fixed
 * pool of runners pulling from a shared cursor. Rejections propagate. When
 * `signal` aborts, in-flight work finishes but no new items are started.
 */
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  signal: AbortSignal | undefined,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const runnerCount = Math.max(1, Math.min(limit, items.length));
  const runners = Array.from({ length: runnerCount }, async () => {
    while (cursor < items.length && !signal?.aborted) {
      const index = cursor++;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
}

type TileGroup = {
  tileX: number;
  tileY: number;
  entries: { index: number; point: LngLat }[];
};

function groupPointsByTile(points: LngLat[], tileZoom: number): TileGroup[] {
  const groups = new Map<string, TileGroup>();
  for (let i = 0; i < points.length; i++) {
    const { lng, lat } = points[i];
    const tile = lngLatToTile(lng, lat, tileZoom);
    const id = `${tile.x}/${tile.y}`;
    let group = groups.get(id);
    if (!group) {
      group = { tileX: tile.x, tileY: tile.y, entries: [] };
      groups.set(id, group);
    }
    group.entries.push({ index: i, point: points[i] });
  }
  return Array.from(groups.values());
}

async function fetchAndDecodeTilePixels(
  tileX: number,
  tileY: number,
  config: TileServerConfig,
  setUpCanvas: CanvasSetupFn,
): Promise<Uint8ClampedArray | null> {
  const url = config.tileUrlTemplate
    .replace("{z}", String(config.tileZoom))
    .replace("{x}", String(tileX))
    .replace("{y}", String(tileY));
  const queryKey = ["terrain-tile", `${tileX}/${tileY}`];

  let blob: Blob | undefined;
  try {
    blob = await queryClient.fetchQuery({
      queryKey,
      queryFn: () => fetchTileFromUrl(url),
    });
  } catch {
    return null;
  }
  if (!blob) return null;

  const { ctx, img } = await setUpCanvas(blob, config.tileSize);
  ctx.drawImage(img, 0, 0, config.tileSize, config.tileSize);
  return ctx.getImageData(0, 0, config.tileSize, config.tileSize).data;
}
