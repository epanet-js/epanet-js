import type { MapEngine } from "./map-engine";

export function captureThumbnail(
  mapEngine: MapEngine,
  width = 320,
  height = 256,
  crop = 0.6,
): string | null {
  try {
    const sourceCanvas = mapEngine.map?.getCanvas();
    if (!sourceCanvas) return null;
    // Scale output to fit within source canvas size while preserving aspect ratio
    const scale = Math.min(
      1,
      sourceCanvas.width / width,
      sourceCanvas.height / height,
    );
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
    return offscreen.toDataURL("image/jpeg", 0.85);
  } catch {
    return null;
  }
}
