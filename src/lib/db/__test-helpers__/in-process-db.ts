import { afterEach, beforeEach } from "vitest";
import { api } from "../db-worker-api";
import { resetDbWorkerForTest, setDbWorkerForTest } from "../get-db-worker";

export const useInProcessDb = (): void => {
  beforeEach(() => {
    setDbWorkerForTest(api);
  });

  afterEach(async () => {
    await api.closeDb();
    resetDbWorkerForTest();
  });
};
