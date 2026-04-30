import { type AssetWriter } from "./asset-writer";

export function writeShpHeader(w: AssetWriter): void {
  const view = w.shpView;
  view.setUint32(0, 0x0000270a, false); // file code, big-endian
  view.setUint32(24, w.shp.length / 2, false); // file length in 16-bit words, big-endian
  view.setUint32(28, 1000, true); // version, little-endian
  view.setUint32(32, w.shapeType, true); // shape type, little-endian
  // bytes 36-99: zeros (bbox + Z/M ranges) — left as zero, bbox patched later
}

export function writeShxHeader(w: AssetWriter): void {
  const view = w.shxView;
  view.setUint32(0, 0x0000270a, false);
  view.setUint32(24, w.shx.length / 2, false);
  view.setUint32(28, 1000, true);
  view.setUint32(32, w.shapeType, true);
}

export function patchBbox(w: AssetWriter): void {
  for (let v = 0; v < 2; v++) {
    const view = v === 0 ? w.shpView : w.shxView;
    view.setFloat64(36, w.bbox.xmin, true);
    view.setFloat64(44, w.bbox.ymin, true);
    view.setFloat64(52, w.bbox.xmax, true);
    view.setFloat64(60, w.bbox.ymax, true);
  }
}
