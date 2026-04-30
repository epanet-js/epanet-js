import { type AssetWriter } from "./asset-writer";

export function writePoint(
  w: AssetWriter,
  coords: number[],
  recIdx: number,
): void {
  const base = w.shpCursor;
  const view = w.shpView;

  view.setUint32(base, recIdx, false); // record number, big-endian
  view.setUint32(base + 4, 10, false); // content length = 10 words, big-endian
  view.setUint32(base + 8, 1, true); // shape type 1, little-endian
  view.setFloat64(base + 12, coords[0], true); // X, little-endian
  view.setFloat64(base + 20, coords[1], true); // Y, little-endian

  const x = coords[0];
  const y = coords[1];
  if (x < w.bbox.xmin) w.bbox.xmin = x;
  if (x > w.bbox.xmax) w.bbox.xmax = x;
  if (y < w.bbox.ymin) w.bbox.ymin = y;
  if (y > w.bbox.ymax) w.bbox.ymax = y;

  w.shpCursor += 28;
}

export function writePolyLine(
  w: AssetWriter,
  coords: number[][],
  recIdx: number,
): void {
  const n = coords.length;
  const base = w.shpCursor;
  const view = w.shpView;

  // content = 4 (shape type) + 32 (bbox) + 4 (numParts) + 4 (numPoints) + 4 (parts[0]) + n*16
  //         = 48 + 16n bytes = 24 + 8n words
  const contentLengthWords = 24 + 8 * n;

  view.setUint32(base, recIdx, false); // record number, big-endian
  view.setUint32(base + 4, contentLengthWords, false); // content length, big-endian
  view.setUint32(base + 8, 3, true); // shape type 3, little-endian

  // Compute line bbox, write points, and update writer bbox in one loop
  let xmin = coords[0][0];
  let ymin = coords[0][1];
  let xmax = xmin;
  let ymax = ymin;

  let pOffset = base + 56;
  for (let i = 0; i < n; i++) {
    const x = coords[i][0];
    const y = coords[i][1];

    if (x < xmin) xmin = x;
    if (x > xmax) xmax = x;
    if (y < ymin) ymin = y;
    if (y > ymax) ymax = y;

    if (x < w.bbox.xmin) w.bbox.xmin = x;
    if (x > w.bbox.xmax) w.bbox.xmax = x;
    if (y < w.bbox.ymin) w.bbox.ymin = y;
    if (y > w.bbox.ymax) w.bbox.ymax = y;

    view.setFloat64(pOffset, x, true);
    view.setFloat64(pOffset + 8, y, true);
    pOffset += 16;
  }

  // Write line bbox (bytes 12–43)
  view.setFloat64(base + 12, xmin, true);
  view.setFloat64(base + 20, ymin, true);
  view.setFloat64(base + 28, xmax, true);
  view.setFloat64(base + 36, ymax, true);

  view.setUint32(base + 44, 1, true); // numParts = 1
  view.setUint32(base + 48, n, true); // numPoints = n
  view.setUint32(base + 52, 0, true); // parts[0] = 0

  w.shpCursor += 56 + 16 * n;
}
