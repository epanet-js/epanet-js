import { CustomerPointId } from "@epanet-js/hydraulic-model";
import {
  ModelOperation,
  ModelOperationDeprecated,
  DemandAssignment,
} from "../model-operation";
import { getCustomerPointDemands } from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "../hydraulic-model";
import { changeSet, dropCustomerPoints, setDemands } from "../change-sets";

type InputData = {
  customerPointIds: readonly CustomerPointId[];
};

export const removeCustomerPoints: ModelOperation<InputData> = (
  hydraulicModel,
  { customerPointIds },
) => {
  const { idsToDelete, demandAssignments } = planRemoval(
    hydraulicModel,
    customerPointIds,
  );

  return changeSet(hydraulicModel, "removeCustomerPoints", [
    dropCustomerPoints(idsToDelete),
    setDemands(demandAssignments),
  ]);
};

export const removeCustomerPointsDeprecated: ModelOperationDeprecated<
  InputData
> = (hydraulicModel, { customerPointIds }) => {
  const { idsToDelete, demandAssignments } = planRemoval(
    hydraulicModel,
    customerPointIds,
  );

  return {
    note: "removeCustomerPoints",
    deleteCustomerPoints: idsToDelete,
    ...(demandAssignments.length > 0 && {
      putDemands: { assignments: demandAssignments },
    }),
  };
};

const planRemoval = (
  hydraulicModel: HydraulicModel,
  customerPointIds: readonly CustomerPointId[],
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

  return { idsToDelete, demandAssignments };
};
