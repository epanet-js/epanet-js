import { CustomerPointId } from "@epanet-js/hydraulic-model";
import { isCustomProperty } from "@epanet-js/custom-attributes";
import type { CustomerPointPatch, ModelMoment } from "../model-operation";
import { HydraulicModel } from "../hydraulic-model";
import { CustomerPoints } from "@epanet-js/hydraulic-model";

export type CustomerPointPropertyChange = {
  property: string;
  value: unknown;
};

export function changeCustomerPointProperty(
  { customerPoints }: HydraulicModel,
  {
    customerPointIds,
    property,
    value,
  }: {
    customerPointIds: CustomerPointId[];
    property: string;
    value: unknown;
  },
): ModelMoment {
  const patches = buildPatches(customerPoints, customerPointIds, [
    { property, value },
  ]);
  return {
    note: "Change customer point property",
    patchCustomerPointsAttributes: patches,
  };
}

export function changeCustomerPointProperties(
  { customerPoints }: HydraulicModel,
  {
    customerPointIds,
    changes,
  }: {
    customerPointIds: CustomerPointId[];
    changes: CustomerPointPropertyChange[];
  },
): ModelMoment {
  const patches = buildPatches(customerPoints, customerPointIds, changes);
  return {
    note: "Change customer point properties",
    patchCustomerPointsAttributes: patches,
  };
}

function buildPatches(
  customerPoints: CustomerPoints,
  customerPointIds: CustomerPointId[],
  changes: readonly { property: string; value: unknown }[],
): CustomerPointPatch[] {
  const patches: CustomerPointPatch[] = [];

  for (const customerPointId of customerPointIds) {
    const customerPoint = customerPoints.get(customerPointId);
    if (!customerPoint) {
      throw new Error(`Customer point ${customerPointId} not found`);
    }

    const properties: Record<string, unknown> = {};
    for (const { property, value } of changes) {
      if (!isCustomProperty(property) && !customerPoint.hasProperty(property))
        continue;
      properties[property] = value;
    }

    if (Object.keys(properties).length > 0) {
      patches.push({ id: customerPointId, properties });
    }
  }

  return patches;
}
