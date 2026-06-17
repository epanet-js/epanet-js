import { type CustomerPointId } from "@epanet-js/hydraulic-model";
import {
  calculateAverageDemand,
  getCustomerPointDemands,
  type HydraulicModel,
  type PatternId,
} from "src/hydraulic-model";
import type { UnitsSpec } from "src/lib/project-settings/quantities-spec";

export type CustomerPointRow = {
  id: CustomerPointId;
  label: string;
  connectedPipeLabel: string | null;
  connectedJunctionLabel: string | null;
  baseDemand: number;
  patternId: PatternId | null;
  demandsCount: number;
  avgDemand: number;
};

export type CpAccessorCtx = {
  model: HydraulicModel;
  units: UnitsSpec;
};

const CP_COMPUTED_KEYS = new Set<keyof CustomerPointRow>([
  "connectedPipeLabel",
  "connectedJunctionLabel",
  "baseDemand",
  "avgDemand",
  "demandsCount",
  "patternId",
]);

export function isCpComputedKey(key: string): boolean {
  return CP_COMPUTED_KEYS.has(key as keyof CustomerPointRow);
}

export function cpAccessor(
  key: keyof CustomerPointRow,
  ctx: CpAccessorCtx,
): (row: CustomerPointRow) => unknown {
  return (row) => {
    const { model } = ctx;
    const cp = model.customerPoints.get(row.id);
    if (!cp) return null;

    switch (key) {
      case "connectedPipeLabel":
        return cp.connection
          ? (model.assets.get(cp.connection.pipeId)?.label ?? null)
          : null;
      case "connectedJunctionLabel":
        return cp.connection
          ? (model.assets.get(cp.connection.junctionId)?.label ?? null)
          : null;
      case "demandsCount":
        return getCustomerPointDemands(model.demands, row.id).length;
      case "patternId": {
        const first = getCustomerPointDemands(model.demands, row.id)[0];
        return first?.patternId ?? null;
      }
      case "baseDemand":
        return (
          getCustomerPointDemands(model.demands, row.id)[0]?.baseDemand ?? 0
        );
      case "avgDemand":
        return calculateAverageDemand(
          getCustomerPointDemands(model.demands, row.id),
          model.patterns,
        );
      default:
        return null;
    }
  };
}

export function buildCustomerPointModelRows(
  hydraulicModel: HydraulicModel,
): CustomerPointRow[] {
  const rows: CustomerPointRow[] = [];
  for (const cp of hydraulicModel.customerPoints.values()) {
    rows.push(cp as unknown as CustomerPointRow);
  }
  return rows;
}
