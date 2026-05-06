import { HglRange, ProfilePoint } from "../chart-data";

export type YAxisRange = {
  min: number;
  max: number;
  interval: number;
};

export type ComputeYAxisRangeParams = {
  points: ProfilePoint[];
  terrainData: [number, number][] | null;
  hglRanges: (HglRange | null)[] | null;
};

export function computeYAxisRange({
  points,
  terrainData,
  hglRanges,
}: ComputeYAxisRangeParams): YAxisRange {
  const vals: number[] = [];
  points.forEach((p, i) => {
    vals.push(p.elevation);
    if (p.head !== null) vals.push(p.head);
    const r = hglRanges?.[i];
    if (r) {
      vals.push(r.minHead);
      vals.push(r.maxHead);
    }
  });
  if (terrainData) {
    terrainData.forEach(([, v]) => {
      if (v !== null && v !== undefined) vals.push(v);
    });
  }
  if (vals.length === 0) return { min: 0, max: 100, interval: 100 / 9 };
  const dataMin = Math.min(...vals);
  const dataMax = Math.max(...vals);
  const span = dataMax - dataMin || 10;
  const yMax = dataMax + span * 0.08;
  return { min: dataMin, max: yMax, interval: (yMax - dataMin) / 9 };
}
