import { CustomerPointId } from "@epanet-js/hydraulic-model";
import { isCustomProperty } from "@epanet-js/hydraulic-model";
import type {
  CustomerPointPatch,
  ModelMoment,
  OperationCode,
} from "../model-operation";
import { HydraulicModel } from "../hydraulic-model";
import { CustomerPoints } from "@epanet-js/hydraulic-model";
import type { ChangeSet } from "@epanet-js/change-set";
import { changeSet, setCustomerPoint, type Fields } from "../change-sets";

export type CustomerPointPropertyChange = {
  property: string;
  value: unknown;
};

type ChangeCustomerPointPropertyData = {
  customerPointIds: CustomerPointId[];
  property: string;
  value: unknown;
};

type ChangeCustomerPointPropertiesData = {
  customerPointIds: CustomerPointId[];
  changes: CustomerPointPropertyChange[];
};

export function changeCustomerPointProperty(
  model: HydraulicModel,
  { customerPointIds, property, value }: ChangeCustomerPointPropertyData,
): ChangeSet {
  const patches = buildPatches(model.customerPoints, customerPointIds, [
    { property, value },
  ]);
  return patchesChangeSet(model, "changeCustomerPointProperty", patches);
}

export function changeCustomerPointProperties(
  model: HydraulicModel,
  { customerPointIds, changes }: ChangeCustomerPointPropertiesData,
): ChangeSet {
  const patches = buildPatches(model.customerPoints, customerPointIds, changes);
  return patchesChangeSet(model, "changeCustomerPointProperties", patches);
}

export function changeCustomerPointPropertyDeprecated(
  { customerPoints }: HydraulicModel,
  { customerPointIds, property, value }: ChangeCustomerPointPropertyData,
): ModelMoment {
  const patches = buildPatches(customerPoints, customerPointIds, [
    { property, value },
  ]);
  return {
    note: "changeCustomerPointProperty",
    patchCustomerPointsAttributes: patches,
  };
}

export function changeCustomerPointPropertiesDeprecated(
  { customerPoints }: HydraulicModel,
  { customerPointIds, changes }: ChangeCustomerPointPropertiesData,
): ModelMoment {
  const patches = buildPatches(customerPoints, customerPointIds, changes);
  return {
    note: "changeCustomerPointProperties",
    patchCustomerPointsAttributes: patches,
  };
}

function patchesChangeSet(
  model: HydraulicModel,
  code: OperationCode,
  patches: CustomerPointPatch[],
): ChangeSet {
  return changeSet(
    model,
    code,
    patches.map((patch) =>
      setCustomerPoint(patch.id, patch.properties as Fields),
    ),
  );
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
