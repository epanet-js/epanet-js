import { QueryClient } from "@tanstack/query-core";
import { withDebugInstrumentation } from "src/infra/with-instrumentation";
import { captureWarning } from "src/infra/error-tracking";
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
export const queryClientDeprecated = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime,
      retry: 3,
    },
  },
});

export const tileSize = 512;
export const tileZoom = 14;

export const fallbackElevation = 0;

export type LngLat = { lat: number; lng: number };

export type CanvasSetupFn = (
  blob: Blob,
) => Promise<{ img: CanvasImageSource; ctx: CanvasRenderingContext2D }>;

export async function fetchElevationForPoint(
  { lat, lng }: LngLat,
  {
    unit,
    setUpCanvas = defaultCanvasSetupFn,
  }: { unit: Unit; setUpCanvas?: CanvasSetupFn },
): Promise<number> {
  const { queryKey, url } = buildTileDescriptor(lng, lat);

  const tileBlob = await queryClient.fetchQuery({
    queryKey,
    queryFn: () => fetchTileFromUrl(url),
  });

  if (!tileBlob) {
    return fallbackElevation;
  }

  const { ctx, img } = await setUpCanvas(tileBlob);
  const elevationInMeters = getElevationPixel(ctx, img, { lng, lat });
  return convertTo({ value: elevationInMeters, unit: "m" }, unit);
}

export async function fetchElevationForPointDeprecated(
  { lat, lng }: LngLat,
  {
    unit,
    setUpCanvas = defaultCanvasSetupFn,
  }: { unit: Unit; setUpCanvas?: CanvasSetupFn },
): Promise<number> {
  const { queryKey, url } = buildTileDescriptor(lng, lat);

  const tileBlob = await queryClientDeprecated.fetchQuery({
    queryKey,
    queryFn: () => fetchTileFromUrlDeprecated(url),
  });

  if (!tileBlob) {
    return fallbackElevation;
  }

  const { ctx, img } = await setUpCanvas(tileBlob);
  const elevationInMeters = getElevationPixel(ctx, img, { lng, lat });
  return convertTo({ value: elevationInMeters, unit: "m" }, unit);
}

export async function prefetchElevationsTile({ lng, lat }: LngLat) {
  const { queryKey, url } = buildTileDescriptor(lng, lat);

  await queryClient.prefetchQuery({
    queryKey,
    queryFn: () => fetchTileFromUrl(url),
  });
}

export async function prefetchElevationsTileDeprecated({ lng, lat }: LngLat) {
  const { queryKey, url } = buildTileDescriptor(lng, lat);

  await queryClientDeprecated.prefetchQuery({
    queryKey,
    queryFn: () => fetchTileFromUrlDeprecated(url),
  });
}

const buildTileDescriptor = (lng: number, lat: number) => {
  const tileCoordinates = lngLatToTile(lng, lat, tileZoom);
  const tileUrl = `https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/${tileZoom}/${tileCoordinates.x}/${tileCoordinates.y}@2x.pngraw?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`;
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

const fetchTileFromUrlDeprecated = withDebugInstrumentation(
  async (tileUrl: string): Promise<Blob | null> => {
    const response = await fetch(tileUrl);
    if (!response.ok) {
      captureWarning(`Failed to fetch tile: ${tileUrl}`);
      return null;
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
) => {
  const { lat, lng } = coordinates;
  ctx.drawImage(img, 0, 0, tileSize, tileSize);

  const { x, y } = getPixelDescriptor(lat, lng, tileZoom);

  const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
  return parseFloat(decodeTerrainRGB(r, g, b).toFixed(2));
};

const getPixelDescriptor = (lat: number, lng: number, tileZoom: number) => {
  const scale = Math.pow(2, tileZoom);
  const pixelX = Math.floor(((lng + 180) / 360) * scale * tileSize) % tileSize;
  const pixelY =
    Math.floor(
      ((1 -
        Math.log(
          Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180),
        ) /
          Math.PI) /
        2) *
        scale *
        tileSize,
    ) % tileSize;
  return { x: pixelX, y: pixelY };
};

const defaultCanvasSetupFn: CanvasSetupFn = async (blob: Blob) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = tileSize;
      canvas.height = tileSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is missing");
      resolve({ img, ctx });
    };
    img.src = URL.createObjectURL(blob);
  });
};

function decodeTerrainRGB(r: number, g: number, b: number): number {
  return (r * 256 * 256 + g * 256 + b) * 0.1 - 10000;
}
