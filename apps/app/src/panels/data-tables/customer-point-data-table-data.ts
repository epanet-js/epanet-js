import { type CustomerPointId } from "@epanet-js/hydraulic-model";
import {
  calculateAverageDemand,
  getCustomerPointDemands,
  type HydraulicModel,
  type PatternId,
} from "src/hydraulic-model";
import { convertTo } from "@epanet-js/quantity";
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

/**
 * Context captured by the lazy customer-point accessors (flag path). Read on
 * demand inside `accessorFn`, so the columns are rebuilt when these change.
 */
export type CpAccessorCtx = {
  model: HydraulicModel;
  units: UnitsSpec;
};

// Every customer-point column except `label` is computed/converted from the
// model; `label` is a direct own property read via `accessorKey`.
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

/**
 * Returns an `accessorFn` that lazily computes a single computed customer-point
 * column for a model-object row. Reuses `buildCustomerPointRow` and picks the
 * requested field; invoked only for rendered rows + the sorted column.
 */
export function cpAccessor(
  key: keyof CustomerPointRow,
  ctx: CpAccessorCtx,
): (row: CustomerPointRow) => unknown {
  return (row) => {
    const built = buildCustomerPointRow(row.id, ctx.model, ctx.units);
    return built ? built[key] : null;
  };
}

/**
 * Flag path: the grid rows ARE the CustomerPoint objects (no flat-row build).
 */
export function buildCustomerPointModelRows(
  hydraulicModel: HydraulicModel,
): CustomerPointRow[] {
  const rows: CustomerPointRow[] = [];
  for (const cp of hydraulicModel.customerPoints.values()) {
    rows.push(cp as unknown as CustomerPointRow);
  }
  return rows;
}

const CHUNK_SIZE = 200;

function yieldToMain(): Promise<void> {
  const scheduler = (globalThis as Record<string, unknown>)["scheduler"] as
    | {
        postTask?: (
          cb: () => void,
          opts: { priority: string },
        ) => Promise<void>;
      }
    | undefined;
  if (scheduler?.postTask) {
    return scheduler.postTask(() => {}, { priority: "user-visible" });
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function buildCustomerPointRow(
  id: CustomerPointId,
  hydraulicModel: HydraulicModel,
  units: UnitsSpec,
): CustomerPointRow | null {
  const cp = hydraulicModel.customerPoints.get(id);
  if (!cp) return null;

  const connection = cp.connection;
  const connectedPipeLabel = connection
    ? (hydraulicModel.assets.get(connection.pipeId)?.label ?? null)
    : null;
  const connectedJunctionLabel = connection
    ? (hydraulicModel.assets.get(connection.junctionId)?.label ?? null)
    : null;

  const cpDemands = getCustomerPointDemands(hydraulicModel.demands, id);
  const firstDemand = cpDemands[0];

  const baseDemand = firstDemand
    ? convertTo(
        { value: firstDemand.baseDemand, unit: units.customerDemand },
        units.customerDemandPerDay,
      )
    : 0;

  const avgDemand = convertTo(
    {
      value: calculateAverageDemand(cpDemands, hydraulicModel.patterns),
      unit: units.customerDemand,
    },
    units.customerDemandPerDay,
  );

  return {
    id,
    label: cp.label,
    connectedPipeLabel,
    connectedJunctionLabel,
    baseDemand,
    patternId: firstDemand?.patternId ?? null,
    demandsCount: cpDemands.length,
    avgDemand,
  };
}

export async function buildCustomerPointRowsAsync(
  hydraulicModel: HydraulicModel,
  units: UnitsSpec,
  signal?: AbortSignal,
): Promise<CustomerPointRow[]> {
  const ids = Array.from(hydraulicModel.customerPoints.keys());
  const result: CustomerPointRow[] = [];
  for (let chunkStart = 0; chunkStart < ids.length; chunkStart += CHUNK_SIZE) {
    if (chunkStart > 0) await yieldToMain();
    if (signal?.aborted) return result;
    for (
      let i = chunkStart;
      i < Math.min(chunkStart + CHUNK_SIZE, ids.length);
      i++
    ) {
      const row = buildCustomerPointRow(ids[i], hydraulicModel, units);
      if (row) result.push(row);
    }
  }
  return result;
}
