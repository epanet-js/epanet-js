import { afterEach, beforeEach } from "vitest";
import { api, resetWorkerForTest, setWorkerForTest } from "@epanet-js/ejsdb";

export const useInProcessDb = (): void => {
  beforeEach(() => {
    setWorkerForTest(api);
  });

  afterEach(async () => {
    await api.closeDb();
    resetWorkerForTest();
  });
};
