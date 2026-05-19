import { afterEach, beforeEach } from "vitest";
import { api } from "src/lib/ejsdb/worker-api";
import { resetWorkerForTest, setWorkerForTest } from "src/lib/ejsdb";

export const useInProcessDb = (): void => {
  beforeEach(() => {
    setWorkerForTest(api);
  });

  afterEach(async () => {
    await api.closeDb();
    resetWorkerForTest();
  });
};
