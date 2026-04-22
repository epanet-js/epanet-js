import type {
  CustomerPoint,
  CustomerPointId,
  CustomerPoints,
} from "src/hydraulic-model/customer-points";
import type {
  CustomerAssignedDemands,
  Demand,
} from "src/hydraulic-model/demands";
import { getDbWorker } from "./get-db-worker";
import type {
  CustomerPointRow,
  CustomerPointDemandRow,
  CustomerPointsData,
} from "./rows";

export const toCustomerPointRow = (
  customerPoint: CustomerPoint,
): CustomerPointRow => {
  const connection = customerPoint.connection;
  return {
    id: customerPoint.id,
    label: customerPoint.label,
    coord_x: customerPoint.coordinates[0],
    coord_y: customerPoint.coordinates[1],
    pipe_id: connection ? connection.pipeId : null,
    junction_id: connection ? connection.junctionId : null,
    snap_x: connection ? connection.snapPoint[0] : null,
    snap_y: connection ? connection.snapPoint[1] : null,
  };
};

export const toCustomerPointDemandRow = (
  customerPointId: CustomerPointId,
  demand: Demand,
  ordinal: number,
): CustomerPointDemandRow => ({
  customer_point_id: customerPointId,
  ordinal,
  base_demand: demand.baseDemand,
  pattern_id: demand.patternId ?? null,
});

export const customerPointsToRows = (
  customerPoints: CustomerPoints,
  customerDemands: CustomerAssignedDemands,
): CustomerPointsData => {
  const cpRows: CustomerPointRow[] = [];
  for (const cp of customerPoints.values()) {
    cpRows.push(toCustomerPointRow(cp));
  }
  const demandRows: CustomerPointDemandRow[] = [];
  for (const [cpId, demands] of customerDemands) {
    demands.forEach((demand, ordinal) => {
      demandRows.push(toCustomerPointDemandRow(cpId, demand, ordinal));
    });
  }
  return { customerPoints: cpRows, demands: demandRows };
};

export const setAllCustomerPoints = async (
  customerPoints: CustomerPoints,
  customerDemands: CustomerAssignedDemands,
): Promise<void> => {
  const payload = customerPointsToRows(customerPoints, customerDemands);
  const worker = getDbWorker();
  await worker.setAllCustomerPoints(payload);
};
