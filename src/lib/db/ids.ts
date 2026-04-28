import type { AssetRows } from "./mappers/assets/schema";
import type { CustomerPointsData } from "./mappers/customer-points/schema";
import type { PatternRow } from "./mappers/patterns/schema";
import type { CurveRow } from "./mappers/curves/schema";

export const findMaxId = (
  assetRows: AssetRows,
  cpData?: CustomerPointsData,
  patternRows?: PatternRow[],
  curveRows?: CurveRow[],
): number => {
  let max = 0;
  const scan = (arr: { id: number }[]) => {
    for (const r of arr) if (r.id > max) max = r.id;
  };
  scan(assetRows.junctions);
  scan(assetRows.reservoirs);
  scan(assetRows.tanks);
  scan(assetRows.pipes);
  scan(assetRows.pumps);
  scan(assetRows.valves);
  if (cpData) scan(cpData.customerPoints);
  if (patternRows) scan(patternRows);
  if (curveRows) scan(curveRows);
  return max;
};
