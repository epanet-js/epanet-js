import { OPFSStorage } from "./opfs-storage";
import { getAppId } from "../app-instance";

const TWO_WEEKS_MS = 1000 * 60 * 60 * 24 * 14;
const ONE_MINUTE_MS = 60 * 1000;

let heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;

export const initStorage = async (): Promise<void> => {
  getAppId();
  await OPFSStorage.cleanupStale(TWO_WEEKS_MS);
  startHeartbeat();
};

const startHeartbeat = (): void => {
  if (heartbeatIntervalId !== null) return;

  const storage = new OPFSStorage(getAppId());

  heartbeatIntervalId = setInterval(() => {
    void storage.updateHeartbeat();
  }, ONE_MINUTE_MS);
};

export const stopHeartbeat = (): void => {
  if (heartbeatIntervalId !== null) {
    clearInterval(heartbeatIntervalId);
    heartbeatIntervalId = null;
  }
};
