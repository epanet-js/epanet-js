import {
  CustomerPoint,
  CustomerPointId,
  CustomerPoints,
} from "src/hydraulic-model/customer-points";
import { CustomerPointsLookup } from "src/hydraulic-model/customer-points-lookup";
import { Demand } from "src/hydraulic-model/demands";
import { ModelFactories } from "src/hydraulic-model/factories";
import { parseRows } from "../parse-rows";
import { customerPointRowSchema, customerPointDemandRowSchema } from "./schema";

export type RawCustomerPointsData = {
  customerPoints: unknown[];
  demands: unknown[];
};

export const buildCustomerPointsData = (
  rawData: RawCustomerPointsData,
  factories: ModelFactories,
): {
  customerPoints: CustomerPoints;
  customerPointsLookup: CustomerPointsLookup;
  customerDemands: Map<CustomerPointId, Demand[]>;
} => {
  const customerPoints: CustomerPoints = new Map<number, CustomerPoint>();
  const customerPointsLookup = new CustomerPointsLookup();
  const customerDemands = new Map<CustomerPointId, Demand[]>();

  const cpRows = parseRows(
    customerPointRowSchema,
    rawData.customerPoints,
    "CustomerPoints",
  );
  const demandRows = parseRows(
    customerPointDemandRowSchema,
    rawData.demands,
    "CustomerPointDemands",
  );

  for (const row of cpRows) {
    const customerPoint = factories.customerPointFactory.load({
      id: row.id,
      coordinates: [row.coord_x, row.coord_y],
      label: row.label,
    });
    if (
      row.pipe_id !== null &&
      row.junction_id !== null &&
      row.snap_x !== null &&
      row.snap_y !== null
    ) {
      customerPoint.connect({
        pipeId: row.pipe_id,
        junctionId: row.junction_id,
        snapPoint: [row.snap_x, row.snap_y],
      });
      customerPointsLookup.addConnection(customerPoint);
    }
    customerPoints.set(customerPoint.id, customerPoint);
    customerDemands.set(customerPoint.id, []);
  }

  for (const row of demandRows) {
    const list = customerDemands.get(row.customer_point_id);
    if (!list) continue;
    list.push({
      baseDemand: row.base_demand,
      patternId: row.pattern_id ?? undefined,
    });
  }

  return { customerPoints, customerPointsLookup, customerDemands };
};
