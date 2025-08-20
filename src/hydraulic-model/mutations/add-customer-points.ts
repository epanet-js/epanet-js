import { HydraulicModel, AssetsMap } from "src/hydraulic-model/hydraulic-model";
import {
  CustomerPoint,
  getCustomerPoints,
} from "src/hydraulic-model/customer-points";
import { Junction } from "src/hydraulic-model/asset-types/junction";
import { Pipe } from "src/hydraulic-model/asset-types/pipe";

type AddCustomerPointsOptions = {
  preserveJunctionDemands?: boolean;
};

export const addCustomerPoints = (
  hydraulicModel: HydraulicModel,
  customerPointsToAdd: CustomerPoint[],
  options: AddCustomerPointsOptions = {},
): HydraulicModel => {
  const { preserveJunctionDemands = true } = options;
  const updatedAssets = new Map(hydraulicModel.assets);
  const updatedCustomerPoints = new Map(hydraulicModel.customerPoints);

  const modifiedJunctions = new Set<string>();
  const modifiedPipes = new Set<string>();

  for (const customerPoint of customerPointsToAdd) {
    updatedCustomerPoints.set(customerPoint.id, customerPoint);

    if (!customerPoint.connection || !customerPoint.connection.junctionId) {
      continue;
    }

    updateJunctionConnection(
      customerPoint,
      hydraulicModel,
      updatedAssets,
      modifiedJunctions,
      preserveJunctionDemands,
    );

    updatePipeConnection(
      customerPoint,
      hydraulicModel,
      updatedAssets,
      modifiedPipes,
    );
  }

  return {
    ...hydraulicModel,
    version: hydraulicModel.version,
    customerPoints: updatedCustomerPoints,
    assets: updatedAssets,
  };
};

const updateJunctionConnection = (
  customerPoint: CustomerPoint,
  hydraulicModel: HydraulicModel,
  updatedAssets: AssetsMap,
  modifiedJunctions: Set<string>,
  preserveJunctionDemands: boolean,
): void => {
  const junctionId = customerPoint.connection!.junctionId!;
  const originalJunction = hydraulicModel.assets.get(junctionId) as Junction;

  if (!originalJunction) {
    return;
  }

  let junctionCopy: Junction;
  if (!modifiedJunctions.has(junctionId)) {
    junctionCopy = originalJunction.copy();
    const existingCustomerPoints = getCustomerPoints(
      hydraulicModel.customerPoints,
      junctionCopy.customerPointIds,
    );
    existingCustomerPoints.forEach((existingCustomerPoint) => {
      junctionCopy.removeCustomerPoint(existingCustomerPoint.id);
    });
    if (!preserveJunctionDemands) {
      junctionCopy.setBaseDemand(0);
    }
    updatedAssets.set(junctionId, junctionCopy);
    modifiedJunctions.add(junctionId);
  } else {
    junctionCopy = updatedAssets.get(junctionId) as Junction;
  }

  junctionCopy.assignCustomerPoint(customerPoint.id);
};

const updatePipeConnection = (
  customerPoint: CustomerPoint,
  hydraulicModel: HydraulicModel,
  updatedAssets: AssetsMap,
  modifiedPipes: Set<string>,
): void => {
  const pipeId = customerPoint.connection?.pipeId;
  if (!pipeId) {
    return;
  }

  const originalPipe = hydraulicModel.assets.get(pipeId) as Pipe;
  if (!originalPipe) {
    return;
  }

  let pipeCopy: Pipe;
  if (!modifiedPipes.has(pipeId)) {
    pipeCopy = originalPipe.copy();
    updatedAssets.set(pipeId, pipeCopy);
    modifiedPipes.add(pipeId);
  } else {
    pipeCopy = updatedAssets.get(pipeId) as Pipe;
  }

  pipeCopy.assignCustomerPoint(customerPoint.id);
};
