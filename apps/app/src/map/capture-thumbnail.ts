import type { MapEngine } from "@epanet-js/map";

export type ThumbnailFormat = "jpeg" | "png";

export type CaptureThumbnailOptions = {
  width?: number;
  height?: number;
  crop?: number;
  format?: ThumbnailFormat;
  quality?: number;
  allowUpscale?: boolean;
};

export function captureThumbnail(
  mapEngine: MapEngine,
  options: CaptureThumbnailOptions = {},
): string | null {
  const {
    width = 320,
    height = 256,
    crop = 0.6,
    format = "jpeg",
    quality = 0.85,
    allowUpscale = false,
  } = options;

  try {
    const sourceCanvas = mapEngine.map?.getCanvas();
    if (!sourceCanvas) return null;
    // Scale output to fit within source canvas size while preserving aspect ratio
    const scale = allowUpscale
      ? 1
      : Math.min(1, sourceCanvas.width / width, sourceCanvas.height / height);
    const outW = Math.round(width * scale);
    const outH = Math.round(height * scale);
    const offscreen = document.createElement("canvas");
    offscreen.width = outW;
    offscreen.height = outH;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return null;

    // Work within the center 50% of the source canvas
    const clampedCrop = Math.min(crop, 1);
    const regionW = sourceCanvas.width * clampedCrop;
    const regionH = sourceCanvas.height * clampedCrop;
    const regionX = (sourceCanvas.width - regionW) / 2;
    const regionY = (sourceCanvas.height - regionH) / 2;

    // Fit a crop with the target aspect ratio inside that region
    const targetRatio = outW / outH;
    let sw, sh;
    if (regionW / regionH > targetRatio) {
      // Region is wider than target — fit by height, crop sides
      sh = regionH;
      sw = regionH * targetRatio;
    } else {
      // Region is taller than target — fit by width, crop top/bottom
      sw = regionW;
      sh = regionW / targetRatio;
    }
    const sx = regionX + (regionW - sw) / 2;
    const sy = regionY + (regionH - sh) / 2;

    ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, outW, outH);
    return offscreen.toDataURL(`image/${format}`, quality);
  } catch {
    return null;
  }
}

export const sourceRegionWidthFor = (
  sourceCanvas: HTMLCanvasElement,
  width: number,
  height: number,
): number => {
  const targetRatio = width / height;
  return sourceCanvas.width / sourceCanvas.height > targetRatio
    ? sourceCanvas.height * targetRatio
    : sourceCanvas.width;
};
