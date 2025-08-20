import { CustomerPoint } from "../customer-points";
import { ModelOperation } from "../model-operation";
import { Junction } from "../asset-types/junction";
import { Pipe } from "../asset-types/pipe";
import { Asset } from "../asset-types";
import { AssetsMap } from "../hydraulic-model";

type InputData = {
  customerPointIds: readonly string[];
};

export const disconnectCustomers: ModelOperation<InputData> = (
  { customerPoints, assets },
  { customerPointIds },
) => {
  const disconnectedCustomerPoints: CustomerPoint[] = [];
  const modifiedJunctions = new Map<string, Junction>();
  const modifiedPipes = new Map<string, Pipe>();

  for (const id of customerPointIds) {
    const customerPoint = customerPoints.get(id);
    if (!customerPoint) {
      throw new Error(`Customer point with id ${id} not found`);
    }

    const disconnectedCopy = customerPoint.copy();
    disconnectedCustomerPoints.push(disconnectedCopy);

    handleJunctionDisconnection(
      customerPoint,
      disconnectedCopy,
      assets,
      modifiedJunctions,
    );

    handlePipeDisconnection(
      customerPoint,
      disconnectedCopy,
      assets,
      modifiedPipes,
    );
  }

  const putAssets: Asset[] = [
    ...Array.from(modifiedJunctions.values()),
    ...Array.from(modifiedPipes.values()),
  ];

  return {
    note: "Disconnect customers",
    putCustomerPoints: disconnectedCustomerPoints,
    ...(putAssets.length > 0 && { putAssets }),
  };
};

const handleJunctionDisconnection = (
  customerPoint: CustomerPoint,
  disconnectedCopy: CustomerPoint,
  assets: AssetsMap,
  modifiedJunctions: Map<string, Junction>,
): void => {
  if (customerPoint.connection?.junctionId) {
    const junctionId = customerPoint.connection.junctionId;
    const originalJunction = assets.get(junctionId) as Junction;

    if (originalJunction) {
      let junctionCopy: Junction;
      if (modifiedJunctions.has(junctionId)) {
        junctionCopy = modifiedJunctions.get(junctionId)!;
      } else {
        junctionCopy = originalJunction.copy();
        modifiedJunctions.set(junctionId, junctionCopy);
      }

      junctionCopy.removeCustomerPoint(customerPoint.id);
    }
  }
};

const handlePipeDisconnection = (
  customerPoint: CustomerPoint,
  disconnectedCopy: CustomerPoint,
  assets: AssetsMap,
  modifiedPipes: Map<string, Pipe>,
): void => {
  if (customerPoint.connection?.pipeId) {
    const pipeId = customerPoint.connection.pipeId;
    const originalPipe = assets.get(pipeId) as Pipe;

    if (originalPipe) {
      let pipeCopy: Pipe;
      if (modifiedPipes.has(pipeId)) {
        pipeCopy = modifiedPipes.get(pipeId)!;
      } else {
        pipeCopy = originalPipe.copy();
        modifiedPipes.set(pipeId, pipeCopy);
      }

      pipeCopy.removeCustomerPoint(customerPoint.id);
    }
  }
};
