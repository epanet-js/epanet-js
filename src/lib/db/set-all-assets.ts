import { AssetsMap } from "src/hydraulic-model/assets-map";
import { getDbWorker } from "./get-db-worker";
import { timed } from "./perf-log";
import { assetsToRows } from "./mappers/assets/to-rows";

export const setAllAssets = async (assets: AssetsMap): Promise<void> => {
  await timed("setAllAssets", async () => {
    const payload = assetsToRows(assets.values());
    const worker = getDbWorker();
    await worker.setAllAssets(payload);
  });
};
