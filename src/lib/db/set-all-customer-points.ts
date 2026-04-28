import type { CustomerPoints } from "src/hydraulic-model/customer-points";
import type { CustomerAssignedDemands } from "src/hydraulic-model/demands";
import { getDbWorker } from "./get-db-worker";
import { timed } from "./perf-log";
import { customerPointsToRows } from "./mappers/customer-points/to-rows";

export const setAllCustomerPoints = async (
  customerPoints: CustomerPoints,
  customerDemands: CustomerAssignedDemands,
): Promise<void> => {
  await timed("setAllCustomerPoints", async () => {
    const payload = customerPointsToRows(customerPoints, customerDemands);
    const worker = getDbWorker();
    await worker.setAllCustomerPoints(payload);
  });
};
