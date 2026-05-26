import { CustomerPointId } from "../customer-points";
import { ModelOperation, DemandAssignment } from "../model-operation";
import { getCustomerPointDemands } from "../demands";

type InputData = {
  customerPointIds: readonly CustomerPointId[];
};

export const removeCustomerPoints: ModelOperation<InputData> = (
  hydraulicModel,
  { customerPointIds },
) => {
  const idsToDelete: CustomerPointId[] = [];
  const demandAssignments: DemandAssignment[] = [];

  for (const id of customerPointIds) {
    const customerPoint = hydraulicModel.customerPoints.get(id);
    if (!customerPoint) {
      throw new Error(`Customer point with id ${id} not found`);
    }

    idsToDelete.push(id);

    const existingDemands = getCustomerPointDemands(hydraulicModel.demands, id);
    if (existingDemands.length > 0) {
      demandAssignments.push({ customerPointId: id, demands: [] });
    }
  }

  return {
    note: "Remove customer points",
    deleteCustomerPoints: idsToDelete,
    ...(demandAssignments.length > 0 && {
      putDemands: { assignments: demandAssignments },
    }),
  };
};
