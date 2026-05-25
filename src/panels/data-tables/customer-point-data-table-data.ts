import type { CustomerPointId } from "src/hydraulic-model/customer-points";
import {
  calculateAverageDemand,
  getCustomerPointDemands,
  type HydraulicModel,
} from "src/hydraulic-model";

export type CustomerPointRow = {
  id: CustomerPointId;
  label: string;
  connectedPipeLabel: string | null;
  connectedJunctionLabel: string | null;
  avgDemand: number;
};

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

  const avgDemand = calculateAverageDemand(
    getCustomerPointDemands(hydraulicModel.demands, id),
    hydraulicModel.patterns,
  );

  return {
    id,
    label: cp.label,
    connectedPipeLabel,
    connectedJunctionLabel,
    avgDemand,
  };
}

export async function buildCustomerPointRowsAsync(
  hydraulicModel: HydraulicModel,
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
      const row = buildCustomerPointRow(ids[i], hydraulicModel);
      if (row) result.push(row);
    }
  }
  return result;
}
