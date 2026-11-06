import { type AssetWriter } from "./asset-writer";

export function writePoint(
  w: AssetWriter,
  coords: number[],
  recIdx: number,
): void {
  const base = w.shpCursor;
  const view = w.shpView;

  view.setUint32(base, recIdx, false);
  view.setUint32(base + 4, 10, false);
  view.setUint32(base + 8, 1, true);
  view.setFloat64(base + 12, coords[0], true);
  view.setFloat64(base + 20, coords[1], true);

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

  const contentLengthWords = 24 + 8 * n;

  view.setUint32(base, recIdx, false);
  view.setUint32(base + 4, contentLengthWords, false);
  view.setUint32(base + 8, 3, true);

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

  view.setFloat64(base + 12, xmin, true);
  view.setFloat64(base + 20, ymin, true);
  view.setFloat64(base + 28, xmax, true);
  view.setFloat64(base + 36, ymax, true);

  view.setUint32(base + 44, 1, true);
  view.setUint32(base + 48, n, true);
  view.setUint32(base + 52, 0, true);

  w.shpCursor += 56 + 16 * n;
}

export function polygonRecordBytes(rings: number[][][]): number {
  let points = 0;
  for (const ring of rings) points += ring.length;
  return 52 + 4 * rings.length + 16 * points;
}

export function writePolygon(
  w: AssetWriter,
  rings: number[][][],
  recIdx: number,
): number {
  const numParts = rings.length;
  let numPoints = 0;
  for (const ring of rings) numPoints += ring.length;

  const base = w.shpCursor;
  const view = w.shpView;
  const contentLengthWords = 22 + 2 * numParts + 8 * numPoints;

  view.setUint32(base, recIdx, false);
  view.setUint32(base + 4, contentLengthWords, false);
  view.setUint32(base + 8, 5, true);
  view.setUint32(base + 44, numParts, true);
  view.setUint32(base + 48, numPoints, true);

  let xmin = Infinity;
  let ymin = Infinity;
  let xmax = -Infinity;
  let ymax = -Infinity;

  let partOffset = base + 52;
  let pOffset = base + 52 + 4 * numParts;
  let start = 0;
  for (const ring of rings) {
    view.setUint32(partOffset, start, true);
    partOffset += 4;
    start += ring.length;

    for (const [x, y] of ring) {
      if (x < xmin) xmin = x;
      if (x > xmax) xmax = x;
      if (y < ymin) ymin = y;
      if (y > ymax) ymax = y;

      view.setFloat64(pOffset, x, true);
      view.setFloat64(pOffset + 8, y, true);
      pOffset += 16;
    }
  }

  view.setFloat64(base + 12, xmin, true);
  view.setFloat64(base + 20, ymin, true);
  view.setFloat64(base + 28, xmax, true);
  view.setFloat64(base + 36, ymax, true);

  if (xmin < w.bbox.xmin) w.bbox.xmin = xmin;
  if (xmax > w.bbox.xmax) w.bbox.xmax = xmax;
  if (ymin < w.bbox.ymin) w.bbox.ymin = ymin;
  if (ymax > w.bbox.ymax) w.bbox.ymax = ymax;

  w.shpCursor += 8 + 2 * contentLengthWords;
  return contentLengthWords;
}

export function shapefileRings(polygons: number[][][][]): number[][][] {
  const rings: number[][][] = [];
  for (const polygon of polygons) {
    polygon.forEach((ring, index) => {
      const isClockwise = signedArea(ring) < 0;
      const wantsClockwise = index === 0;
      rings.push(isClockwise === wantsClockwise ? ring : [...ring].reverse());
    });
  }
  return rings;
}

const signedArea = (ring: number[][]): number => {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return area / 2;
};
