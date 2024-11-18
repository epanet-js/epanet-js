import { QueryClient } from "@tanstack/react-query";
import { withInstrumentation } from "src/infra/with-instrumentation";
import { captureWarning } from "src/infra/error-tracking";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
    },
  },
});

const tileSize = 512;
const fallbackElevation = 0;
const tileZoom = 14;

type LngLat = { lat: number; lng: number };

export async function fetchElevationForPoint({
  lat,
  lng,
}: LngLat): Promise<number> {
  const { queryKey, url } = buildTileDescriptor(lng, lat);

  const tileBlob = await queryClient.fetchQuery({
    queryKey,
    queryFn: () => fetchTileFromUrl(url),
  });

  if (!tileBlob) {
    return fallbackElevation;
  }

  const elevationInMeters = await getPixelElevation(
    tileBlob,
    lng,
    lat,
    tileSize,
  );
  return parseFloat(elevationInMeters.toFixed(2));
}

export async function prefetchElevationsTile({ lng, lat }: LngLat) {
  const { queryKey, url } = buildTileDescriptor(lng, lat);

  await queryClient.prefetchQuery({
    queryKey,
    queryFn: () => fetchTileFromUrl(url),
  });
}

const buildTileDescriptor = (lng: number, lat: number) => {
  const tileCoordinates = lngLatToTile(lng, lat, tileZoom);
  const tileUrl = `https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/${tileZoom}/${tileCoordinates.x}/${tileCoordinates.y}@2x.pngraw?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`;
  const id = `${tileCoordinates.x}/${tileCoordinates.y}`;
  return { url: tileUrl, queryKey: ["terrain-tile", id] };
};

const fetchTileFromUrl = withInstrumentation(
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

async function getPixelElevation(
  blob: Blob,
  lng: number,
  lat: number,
  tileSize: number,
): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = tileSize;
      canvas.height = tileSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is missing");
      ctx.drawImage(img, 0, 0, tileSize, tileSize);

      const scale = Math.pow(2, 14);
      const pixelX =
        Math.floor(((lng + 180) / 360) * scale * tileSize) % tileSize;
      const pixelY =
        Math.floor(
          ((1 -
            Math.log(
              Math.tan((lat * Math.PI) / 180) +
                1 / Math.cos((lat * Math.PI) / 180),
            ) /
              Math.PI) /
            2) *
            scale *
            tileSize,
        ) % tileSize;

      const [r, g, b] = ctx.getImageData(pixelX, pixelY, 1, 1).data;
      resolve(decodeTerrainRGB(r, g, b));
    };
    img.src = URL.createObjectURL(blob);
  });
}

function decodeTerrainRGB(r: number, g: number, b: number): number {
  return (r * 256 * 256 + g * 256 + b) * 0.1 - 10000;
}
