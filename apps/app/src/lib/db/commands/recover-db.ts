import { getWorker, timed } from "@epanet-js/ejsdb";

export const exportDbFromPool = async (
  poolId: string,
): Promise<Blob | null> => {
  return timed("exportDbFromPool", async () => {
    const worker = getWorker();
    const bytes = await worker.exportDbFromPool(poolId);
    if (!bytes) return null;
    return new Blob([bytes], { type: "application/octet-stream" });
  });
};
