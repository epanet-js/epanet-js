import {
  CustomerPoint,
  CustomerPointAllocationResult,
} from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "../hydraulic-model";
import { ModelOperation, ModelOperationDeprecated } from "../model-operation";
import { changeSet, putCustomerPoints } from "../change-sets";
import { connectedCopies } from "./connect-customers";
import { Position } from "src/types";

type InputData = {
  allocationResult: CustomerPointAllocationResult;
};

export const applyCustomerPointAllocation: ModelOperation<InputData> = (
  hydraulicModel,
  { allocationResult },
) =>
  changeSet(hydraulicModel, "applyCustomerPointAllocation", [
    putCustomerPoints(allocatedCopies(hydraulicModel, allocationResult)),
  ]);

export const applyCustomerPointAllocationDeprecated: ModelOperationDeprecated<
  InputData
> = (hydraulicModel, { allocationResult }) => ({
  note: "applyCustomerPointAllocation",
  putCustomerPoints: allocatedCopies(hydraulicModel, allocationResult),
});

const allocatedCopies = (
  hydraulicModel: HydraulicModel,
  allocationResult: CustomerPointAllocationResult,
): CustomerPoint[] => {
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

  const allPutCustomerPoints: CustomerPoint[] = [];

  for (const [
    pipeId,
    { customerPointIds, snapPoints },
  ] of customerPointsByPipe) {
    allPutCustomerPoints.push(
      ...connectedCopies(hydraulicModel, {
        customerPointIds,
        pipeId,
        snapPoints,
      }),
    );
  }

  return allPutCustomerPoints;
};
