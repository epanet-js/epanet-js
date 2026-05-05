import { type AssetWriter } from "./asset-writer";

export function writeShpHeader(w: AssetWriter): void {
  const view = w.shpView;
  view.setUint32(0, 0x0000270a, false);
  view.setUint32(24, w.shp.length / 2, false);
  view.setUint32(28, 1000, true);
  view.setUint32(32, w.shapeType, true);
}

export function writeShxHeader(w: AssetWriter): void {
  const view = w.shxView;
  view.setUint32(0, 0x0000270a, false);
  view.setUint32(24, w.shx.length / 2, false);
  view.setUint32(28, 1000, true);
  view.setUint32(32, w.shapeType, true);
}

export function patchBbox(w: AssetWriter): void {
  for (const view of [w.shpView, w.shxView]) {
    view.setFloat64(36, w.bbox.xmin, true);
    view.setFloat64(44, w.bbox.ymin, true);
    view.setFloat64(52, w.bbox.xmax, true);
    view.setFloat64(60, w.bbox.ymax, true);
  }
}
