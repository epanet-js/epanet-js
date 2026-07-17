import { afterEach, beforeEach } from "vitest";
import { resetWorkerForTest, setWorkerForTest } from "@epanet-js/ejsdb";
import { api } from "@epanet-js/ejsdb/worker-api";

export const useInProcessDb = (): void => {
  beforeEach(() => {
    setWorkerForTest(api);
  });

  afterEach(async () => {
    await api.closeDb();
    api.setShadowErrorReporter(null);
    resetWorkerForTest();
  });
};
