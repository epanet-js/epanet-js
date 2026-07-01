import type { CustomAttributesData } from "@epanet-js/custom-attributes";
import { getWorker, timed } from "@epanet-js/ejsdb";
import { serializeCustomAttributesData } from "@epanet-js/ejsdb-mappers";

export const saveCustomAttributesData = async (
  data: CustomAttributesData,
  affectedAssetIds: Set<number>,
): Promise<void> => {
  if (affectedAssetIds.size === 0) return;

  await timed("saveCustomAttributesData", async () => {
    const upserts = serializeCustomAttributesData(data, affectedAssetIds);
    const presentIds = new Set(upserts.map((row) => row.asset_id));
    const deleteIds = [...affectedAssetIds].filter((id) => !presentIds.has(id));
    await getWorker().saveCustomAttributesData({ upserts, deleteIds });
  });
};
