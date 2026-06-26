import type { CustomAttributesDefinition } from "src/lib/custom-attributes";
import { getWorker, timed } from "@epanet-js/ejsdb";
import { serializeCustomAttributesDefinition } from "@epanet-js/ejsdb-mappers";

export const saveCustomAttributes = async (
  definition: CustomAttributesDefinition,
): Promise<void> => {
  await timed("saveCustomAttributes", async () => {
    const data = serializeCustomAttributesDefinition(definition);
    const worker = getWorker();
    await worker.saveCustomAttributesDefinition(data);
  });
};
