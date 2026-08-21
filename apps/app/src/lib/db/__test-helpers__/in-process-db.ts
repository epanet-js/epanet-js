import { afterEach, beforeEach } from "vitest";
import { resetWorkerForTest, setWorkerForTest } from "@epanet-js/ejsdb";
import { api } from "@epanet-js/ejsdb/worker-api";
import { writeQueue } from "src/lib/persistence/write-queue";

export const useInProcessDb = (): void => {
  beforeEach(() => {
    writeQueue.reset();
    setWorkerForTest(api);
  });

  afterEach(async () => {
    await writeQueue.whenIdle();
    await api.closeDb();
    resetWorkerForTest();
  });
};
