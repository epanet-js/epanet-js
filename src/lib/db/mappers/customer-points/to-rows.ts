import type {
  CustomerPoint,
  CustomerPointId,
  CustomerPoints,
} from "src/hydraulic-model/customer-points";
import type {
  CustomerAssignedDemands,
  Demand,
} from "src/hydraulic-model/demands";
import {
  customerPointRowSchema,
  customerPointDemandRowSchema,
  type CustomerPointRow,
  type CustomerPointDemandRow,
  type CustomerPointsData,
} from "./schema";

export const toCustomerPointRow = (
  customerPoint: CustomerPoint,
): CustomerPointRow => {
  const connection = customerPoint.connection;
  const candidate = {
    id: customerPoint.id,
    label: customerPoint.label,
    coord_x: customerPoint.coordinates[0],
    coord_y: customerPoint.coordinates[1],
    pipe_id: connection ? connection.pipeId : null,
    junction_id: connection ? connection.junctionId : null,
    snap_x: connection ? connection.snapPoint[0] : null,
    snap_y: connection ? connection.snapPoint[1] : null,
  };
  const result = customerPointRowSchema.safeParse(candidate);
  if (!result.success) {
    throw new Error(
      `CustomerPoint ${customerPoint.id} (${customerPoint.label}): row does not match schema — ${result.error.message}`,
    );
  }
  return result.data;
};

export const toCustomerPointDemandRow = (
  customerPointId: CustomerPointId,
  demand: Demand,
  ordinal: number,
): CustomerPointDemandRow => {
  const candidate = {
    customer_point_id: customerPointId,
    ordinal,
    base_demand: demand.baseDemand,
    pattern_id: demand.patternId ?? null,
  };
  const result = customerPointDemandRowSchema.safeParse(candidate);
  if (!result.success) {
    throw new Error(
      `CustomerPoint ${customerPointId} demand ${ordinal}: row does not match schema — ${result.error.message}`,
    );
  }
  return result.data;
};

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
