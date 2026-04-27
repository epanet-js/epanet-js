import type { InferSelectModel } from "drizzle-orm";
import {
  junctions,
  reservoirs,
  tanks,
  pipes,
  pumps,
  valves,
  customer_points,
  customer_point_demands,
  patterns,
  junction_demands,
  curves,
} from "./schema";

export type JunctionRow = InferSelectModel<typeof junctions> & { type: string };
export type ReservoirRow = InferSelectModel<typeof reservoirs> & {
  type: string;
};
export type TankRow = InferSelectModel<typeof tanks> & { type: string };
export type PipeRow = InferSelectModel<typeof pipes> & { type: string };
export type PumpRow = InferSelectModel<typeof pumps> & { type: string };
export type ValveRow = InferSelectModel<typeof valves> & { type: string };

export type AssetRows = {
  junctions: JunctionRow[];
  reservoirs: ReservoirRow[];
  tanks: TankRow[];
  pipes: PipeRow[];
  pumps: PumpRow[];
  valves: ValveRow[];
};

export type CustomerPointRow = InferSelectModel<typeof customer_points>;
export type CustomerPointDemandRow = InferSelectModel<
  typeof customer_point_demands
>;

export type CustomerPointsData = {
  customerPoints: CustomerPointRow[];
  demands: CustomerPointDemandRow[];
};

export type PatternRow = InferSelectModel<typeof patterns>;
export type JunctionDemandRow = InferSelectModel<typeof junction_demands>;
export type CurveRow = InferSelectModel<typeof curves>;

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
