import { LngLatLike } from "mapbox-gl";
import { MapEngine } from "./map-engine";
import { isFeatureOn } from "src/infra/feature-flags";
import { withInstrumentation } from "src/infra/with-instrumentation";
import { captureWarning } from "src/infra/error-tracking";

export const getElevationAt = withInstrumentation(
  (mapEngine: MapEngine, lngLat: LngLatLike): number => {
    if (!isFeatureOn("FLAG_ELEVATIONS")) return 0;
    const elevationInMeters = mapEngine.map.queryTerrainElevation(lngLat, {
      exaggerated: false,
    });
    if (elevationInMeters === null) return 0;

    return parseFloat(elevationInMeters.toFixed(2));
  },
  { name: "MAP_QUERY:GET_ELEVATION", maxDurationMs: 100 },
);

const tileCache: { [url: string]: Blob } = {};

export const fetchElevationForPoint = withInstrumentation(
  async (lng: number, lat: number, zoom: number): Promise<number> => {
    const tileSize = 512;
    const fallbackElevation = 0;
    const tileZoom = Math.min(Math.floor(zoom), 18);

    const tileCoords = lngLatToTile(lng, lat, tileZoom);
    const tileUrl = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${tileCoords.z}/${tileCoords.x}/${tileCoords.y}@2x.pngraw?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`;
    const tileBlob = tileCache[tileUrl]
      ? tileCache[tileUrl]
      : await fetchTile(tileUrl);

    if (!tileBlob) return fallbackElevation;

    const elevation = await getPixelElevation(
      tileBlob,
      lng,
      lat,
      tileCoords,
      zoom,
      tileSize,
    );
    return parseFloat(elevation.toFixed(2));
  },
  { name: "FETCH_ELEVATION", maxDurationMs: 500 },
);

const fetchTile = withInstrumentation(
  async (tileUrl: string): Promise<Blob | null> => {
    const response = await fetch(tileUrl);
    if (!response.ok) {
      captureWarning(`Failed to fetch tile: ${tileUrl}`);
      return null;
    }
    const blob = await response.blob();
    tileCache[tileUrl] = blob; // Cache the fetched tile
    return blob;
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
  tileCoords: { x: number; y: number; z: number },
  z: number,
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

      const scale = Math.pow(2, z);
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
