import { cleanupStaleOPFS } from "./opfs-storage";
import { getAppId } from "../app-instance";

const TWO_WEEKS_MS = 1000 * 60 * 60 * 24 * 14;

export const initStorage = async (): Promise<void> => {
  getAppId();
  await cleanupStaleOPFS(TWO_WEEKS_MS);
};
