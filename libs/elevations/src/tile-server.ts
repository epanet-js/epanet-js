import { QueryClient } from "@tanstack/query-core";
import { Unit, convertTo } from "@epanet-js/quantity";
import type {
  CanvasSetupFn,
  LngLat,
  Raster2D,
  TileServerConfig,
} from "./types";

const staleTime = 5 * 60 * 1000;

/**
 * Shared tile cache. Both the single-point path here and any batched engine
 * built on top read through this one client, so a tile warmed by an
 * interactive prefetch is reused by a later bulk pass.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime,
      retry: false,
    },
  },
});

export const tileSize = 512;
export const tileZoom = 14;

/**
 * Fallback only. Every production path resolves a point against a configured
 * `TileServerElevationSource`, which carries its own template and access token;
 * this bare template exists so a caller that omits one still addresses a tile.
 */
const defaultTileUrlTemplate =
  "https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}@2x.pngraw";

export const defaultTileServerConfig = (): TileServerConfig => ({
  tileUrlTemplate: defaultTileUrlTemplate,
  tileZoom,
  tileSize,
});

export const resolveTileServerConfig = (
  tileServer: TileServerConfig | undefined,
): TileServerConfig => tileServer ?? defaultTileServerConfig();

/**
 * Wraps the raw tile fetch. The app injects its debug instrumentation;
 * everything else gets the identity, so this package stays free of app infra.
 */
export type Instrument = (
  fn: (tileUrl: string) => Promise<Blob>,
) => (tileUrl: string) => Promise<Blob>;

/**
 * `uncovered` means the server has no tile there — a real answer, and terminal.
 * `unavailable` is a transport failure, which may succeed on another attempt.
 */
export type TileFetchFailure = "uncovered" | "unavailable";

export class TileFetchError extends Error {
  public readonly failure: TileFetchFailure;

  constructor(failure: TileFetchFailure, message: string) {
    super(message);
    this.name = "TileFetchError";
    this.failure = failure;
  }
}

export const tileFetchFailureOf = (error: unknown): TileFetchFailure | null => {
  if (typeof error !== "object" || error === null) return null;
  const candidate = error as { name?: unknown; failure?: unknown };
  if (candidate.name !== "TileFetchError") return null;
  return candidate.failure === "uncovered" ? "uncovered" : "unavailable";
};

const rawFetchTileFromUrl = async (tileUrl: string): Promise<Blob> => {
  const response = await fetch(tileUrl);
  if (!response.ok) {
    // Messages are load-bearing: the app matches on them to choose a toast.
    if (response.status === 404) {
      throw new TileFetchError("uncovered", "Tile not found");
    }
    throw new TileFetchError("unavailable", "Failed to fetch");
  }
  return response.blob();
};

let instrumented = rawFetchTileFromUrl;

export const setTileFetchInstrument = (instrument: Instrument): void => {
  instrumented = instrument(rawFetchTileFromUrl);
};

const RETRY_BASE_MS = 250;
const RETRY_JITTER_MS = 500;

const backoffDelay = (attempt: number) =>
  RETRY_BASE_MS * 2 ** (attempt - 1) + Math.random() * RETRY_JITTER_MS;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retries live here rather than in the query client's defaults: a default would
 * also retry prefetches (fire-and-forget, one per throttled mousemove) and the
 * interactive single-point path, where failing fast is what the UI wants. Only
 * the batch path opts into more than one attempt. Because this runs inside the
 * `queryFn`, a successful retry is what gets cached.
 */
export const fetchTileFromUrl = async (
  tileUrl: string,
  { attempts = 1 }: { attempts?: number } = {},
): Promise<Blob> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await instrumented(tileUrl);
    } catch (error) {
      // No amount of retrying will make the server have this tile.
      if (tileFetchFailureOf(error) === "uncovered") throw error;
      lastError = error;
      if (attempt < attempts) await wait(backoffDelay(attempt));
    }
  }

  throw lastError;
};

export function lngLatToTile(lng: number, lat: number, zoom: number) {
  const scale = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * scale);
  const y = Math.floor(
    ((1 -
      Math.log(
        Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180),
      ) /
        Math.PI) /
      2) *
      scale,
  );
  return { x, y, z: zoom };
}

export const getPixelDescriptor = (
  lat: number,
  lng: number,
  config: TileServerConfig,
) => {
  const scale = Math.pow(2, config.tileZoom);
  const pixelX =
    Math.floor(((lng + 180) / 360) * scale * config.tileSize) % config.tileSize;
  const pixelY =
    Math.floor(
      ((1 -
        Math.log(
          Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180),
        ) /
          Math.PI) /
        2) *
        scale *
        config.tileSize,
    ) % config.tileSize;
  return { x: pixelX, y: pixelY };
};

export function decodeTerrainRGB(r: number, g: number, b: number): number {
  return (r * 256 * 256 + g * 256 + b) * 0.1 - 10000;
}

export const buildTileDescriptor = (
  lng: number,
  lat: number,
  config: TileServerConfig,
) => {
  const tileCoordinates = lngLatToTile(lng, lat, config.tileZoom);
  const tileUrl = config.tileUrlTemplate
    .replace("{z}", String(config.tileZoom))
    .replace("{x}", String(tileCoordinates.x))
    .replace("{y}", String(tileCoordinates.y));
  const id = `${tileCoordinates.x}/${tileCoordinates.y}`;
  return { url: tileUrl, queryKey: ["terrain-tile", id] };
};

export const browserCanvasSetup: CanvasSetupFn = async (
  blob: Blob,
  size: number,
) => {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is missing");
      resolve({ img, ctx });
    };
    img.src = objectUrl;
  });
};

/** Worker-safe counterpart: `createImageBitmap` + `OffscreenCanvas`. */
export const offscreenCanvasSetup: CanvasSetupFn = async (
  blob: Blob,
  size: number,
) => {
  const img = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("OffscreenCanvas context could not be created.");
  return { img, ctx: ctx as Raster2D };
};

/**
 * `createImageBitmap` hands back a decoded copy of the tile — ~4 MB for a @2x
 * 512 tile — that lives until it is closed or collected. A bulk run over
 * thousands of tiles cannot wait for the collector, so every decode releases
 * its image as soon as the pixels are read.
 */
export const releaseTileImage = (img: CanvasImageSource): void => {
  const closable = img as { close?: () => void };
  if (typeof closable.close === "function") closable.close();
};

export function readElevationFromPixels(
  pixels: Uint8ClampedArray,
  point: LngLat,
  config: TileServerConfig,
  unit: Unit,
): number {
  const { x, y } = getPixelDescriptor(point.lat, point.lng, config);
  const offset = (y * config.tileSize + x) * 4;
  const elevationInMeters = parseFloat(
    decodeTerrainRGB(
      pixels[offset],
      pixels[offset + 1],
      pixels[offset + 2],
    ).toFixed(2),
  );
  return convertTo({ value: elevationInMeters, unit: "m" }, unit);
}

export async function fetchElevationForPoint(
  { lat, lng }: LngLat,
  {
    unit,
    tileServer,
    setUpCanvas = browserCanvasSetup,
  }: {
    unit: Unit;
    tileServer?: TileServerConfig;
    setUpCanvas?: CanvasSetupFn;
  },
): Promise<number> {
  const config = resolveTileServerConfig(tileServer);
  const { queryKey, url } = buildTileDescriptor(lng, lat, config);

  const tileBlob = await queryClient.fetchQuery({
    queryKey,
    queryFn: () => fetchTileFromUrl(url),
  });

  if (!tileBlob) {
    throw new Error("Tile not found");
  }

  const { ctx, img } = await setUpCanvas(tileBlob, config.tileSize);
  try {
    ctx.drawImage(img, 0, 0, config.tileSize, config.tileSize);
    const { x, y } = getPixelDescriptor(lat, lng, config);
    const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
    const elevationInMeters = parseFloat(decodeTerrainRGB(r, g, b).toFixed(2));
    return convertTo({ value: elevationInMeters, unit: "m" }, unit);
  } finally {
    releaseTileImage(img);
  }
}

export async function prefetchElevationsTile(
  { lng, lat }: LngLat,
  config?: TileServerConfig,
) {
  const resolved = resolveTileServerConfig(config);
  const { queryKey, url } = buildTileDescriptor(lng, lat, resolved);

  await queryClient.prefetchQuery({
    queryKey,
    queryFn: () => fetchTileFromUrl(url),
  });
}
