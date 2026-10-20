import { cleanupStaleOPFS } from "@epanet-js/simulation/browser";
import { getAppId } from "../app-instance";

const TWO_WEEKS_MS = 1000 * 60 * 60 * 24 * 14;

export const initStorage = async (): Promise<void> => {
  const appId = getAppId();
  await cleanupStaleOPFS(TWO_WEEKS_MS, appId);
};
