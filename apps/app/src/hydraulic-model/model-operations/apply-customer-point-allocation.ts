import { HydraulicModel } from "../hydraulic-model";
import { ModelMoment, ModelOperation } from "../model-operation";
import { AllocationResult } from "../../lib/customer-points/types";
import { connectCustomers } from "./connect-customers";
import { Position } from "src/types";

type InputData = {
  allocationResult: AllocationResult;
};

export const applyCustomerPointAllocation: ModelOperation<InputData> = (
  hydraulicModel,
  { allocationResult },
) => {
  const customerPointsByPipe = new Map<
    number,
    { customerPointIds: number[]; snapPoints: Position[] }
  >();

  for (const customer of allocationResult.allocatedCustomerPoints.values()) {
    if (!customer.connection) continue;
    const { pipeId, snapPoint } = customer.connection;

    let entry = customerPointsByPipe.get(pipeId);
    if (!entry) {
      entry = { customerPointIds: [], snapPoints: [] };
      customerPointsByPipe.set(pipeId, entry);
    }
    entry.customerPointIds.push(customer.id);
    entry.snapPoints.push(snapPoint);
  }

  return generateSingleMoment(customerPointsByPipe, hydraulicModel);
};

const generateSingleMoment = (
  customerPointsByPipe: Map<
    number,
    { customerPointIds: number[]; snapPoints: Position[] }
  >,
  hydraulicModel: HydraulicModel,
): ModelMoment => {
  const allPutCustomerPoints = [];

  for (const [
    pipeId,
    { customerPointIds, snapPoints },
  ] of customerPointsByPipe) {
    const moment = connectCustomers(hydraulicModel, {
      customerPointIds,
      pipeId,
      snapPoints,
    });
    if (moment.putCustomerPoints) {
      allPutCustomerPoints.push(...moment.putCustomerPoints);
    }
  }

  return {
    note: "Allocate customer points",
    putCustomerPoints: allPutCustomerPoints,
  };
};
