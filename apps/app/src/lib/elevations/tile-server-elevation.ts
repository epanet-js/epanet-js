import { QueryClient } from "@tanstack/query-core";
import { withDebugInstrumentation } from "src/infra/with-instrumentation";
import { Unit, convertTo } from "src/quantity";

const staleTime = 5 * 60 * 1000;
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

const defaultTileUrlTemplate = `https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}@2x.pngraw?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`;

export const fallbackElevation = 0;

export type LngLat = { lat: number; lng: number };

export type CanvasSetupFn = (
  blob: Blob,
  size: number,
) => Promise<{ img: CanvasImageSource; ctx: CanvasRenderingContext2D }>;

export type TileServerConfig = {
  tileUrlTemplate: string;
  tileZoom: number;
  tileSize: number;
};

export async function fetchElevationForPoint(
  { lat, lng }: LngLat,
  {
    unit,
    tileServer,
    setUpCanvas = defaultCanvasSetupFn,
  }: { unit: Unit; tileServer?: TileServerConfig; setUpCanvas?: CanvasSetupFn },
): Promise<number> {
  const config = tileServer ?? {
    tileUrlTemplate: defaultTileUrlTemplate,
    tileZoom,
    tileSize,
  };
  const { queryKey, url } = buildTileDescriptor(lng, lat, config);

  const tileBlob = await queryClient.fetchQuery({
    queryKey,
    queryFn: () => fetchTileFromUrl(url),
  });

  if (!tileBlob) {
    throw new Error("Tile not found");
  }

  const { ctx, img } = await setUpCanvas(tileBlob, config.tileSize);
  const elevationInMeters = getElevationPixel(ctx, img, { lng, lat }, config);
  return convertTo({ value: elevationInMeters, unit: "m" }, unit);
}

export async function fetchElevationsForPoints(
  points: LngLat[],
  {
    unit,
    tileServer,
    setUpCanvas = defaultCanvasSetupFn,
  }: { unit: Unit; tileServer?: TileServerConfig; setUpCanvas?: CanvasSetupFn },
): Promise<(number | null)[]> {
  const config = resolveTileServerConfig(tileServer);
  const tileGroups = groupPointsByTile(points, config.tileZoom);
  const results: (number | null)[] = points.map(() => null);

  await Promise.all(
    tileGroups.map(async (group) => {
      const pixels = await fetchAndDecodeTilePixels(
        group.tileX,
        group.tileY,
        config,
        setUpCanvas,
      );
      if (!pixels) return;

      for (const { index, point } of group.entries) {
        results[index] = readElevationFromPixels(pixels, point, config, unit);
      }
    }),
  );

  return results;
}

export async function prefetchElevationsTile(
  { lng, lat }: LngLat,
  config?: TileServerConfig,
) {
  const resolved = config ?? {
    tileUrlTemplate: defaultTileUrlTemplate,
    tileZoom,
    tileSize,
  };
  const { queryKey, url } = buildTileDescriptor(lng, lat, resolved);

  await queryClient.prefetchQuery({
    queryKey,
    queryFn: () => fetchTileFromUrl(url),
  });
}

type TileGroup = {
  tileX: number;
  tileY: number;
  entries: { index: number; point: LngLat }[];
};

function resolveTileServerConfig(
  tileServer: TileServerConfig | undefined,
): TileServerConfig {
  return (
    tileServer ?? {
      tileUrlTemplate: defaultTileUrlTemplate,
      tileZoom,
      tileSize,
    }
  );
}

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

function readElevationFromPixels(
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

const buildTileDescriptor = (
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

const fetchTileFromUrl = withDebugInstrumentation(
  async (tileUrl: string): Promise<Blob> => {
    const response = await fetch(tileUrl);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Tile not found");
      }
      throw new Error("Failed to fetch");
    }
    return response.blob();
  },
  {
    name: "FETCH_ELEVATION:FETCH_TILE",
    maxDurationMs: 500,
    maxCalls: 5,
    callsIntervalMs: 1000,
  },
);

function lngLatToTile(lng: number, lat: number, zoom: number) {
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

const getElevationPixel = (
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  coordinates: LngLat,
  config: TileServerConfig,
) => {
  const { lat, lng } = coordinates;
  ctx.drawImage(img, 0, 0, config.tileSize, config.tileSize);

  const { x, y } = getPixelDescriptor(lat, lng, config);

  const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
  return parseFloat(decodeTerrainRGB(r, g, b).toFixed(2));
};

const getPixelDescriptor = (
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

const defaultCanvasSetupFn: CanvasSetupFn = async (
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

function decodeTerrainRGB(r: number, g: number, b: number): number {
  return (r * 256 * 256 + g * 256 + b) * 0.1 - 10000;
}
