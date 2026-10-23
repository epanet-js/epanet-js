import { getWorker, timed } from "@epanet-js/ejsdb";
import type { UserScript } from "src/state/scripts";
import { serializeScript } from "../mappers/scripts/to-rows";

export const saveScript = async (script: UserScript): Promise<void> => {
  await timed("saveScript", async () => {
    await getWorker().saveScript(serializeScript(script));
  });
};

export const deleteScript = async (id: string): Promise<void> => {
  await timed("deleteScript", async () => {
    await getWorker().deleteScript(id);
  });
};
