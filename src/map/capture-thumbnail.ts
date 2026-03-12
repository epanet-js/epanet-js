import type { MapEngine } from "./map-engine";

export function captureThumbnail(
  mapEngine: MapEngine,
  width = 160,
  height = 106,
): string | null {
  try {
    const sourceCanvas = mapEngine.map?.getCanvas();
    if (!sourceCanvas) return null;
    const offscreen = document.createElement("canvas");
    offscreen.width = width;
    offscreen.height = height;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(sourceCanvas, 0, 0, width, height);
    return offscreen.toDataURL("image/jpeg", 0.85);
  } catch {
    return null;
  }
}
