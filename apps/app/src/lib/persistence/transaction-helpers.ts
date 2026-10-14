import type { Getter, Setter, WritableAtom } from "jotai";
import {
  type HydraulicModel,
  updateHydraulicModelAssets,
} from "src/hydraulic-model";
import { CustomerPoints } from "@epanet-js/hydraulic-model";
import type { ChangeSet, Direction } from "@epanet-js/change-set";
import {
  applyChangeSet,
  type ApplyReport,
} from "src/hydraulic-model/change-sets";
import { modelFactoriesAtom } from "src/state/model-factories";
import { mapEditionsTrackerAtom } from "src/state/map";

export function applyChange(
  get: Getter,
  set: Setter,
  stateId: string,
  changeSet: ChangeSet,
  direction: Direction,
  modelAtom: WritableAtom<HydraulicModel, [HydraulicModel], void>,
): ApplyReport {
  const hydraulicModel = get(modelAtom);

  const factories = get(modelFactoriesAtom);
  const report = applyChangeSet(
    hydraulicModel,
    changeSet,
    direction,
    factories.labelManager,
  );

  set(modelAtom, settleAppliedModel(hydraulicModel, stateId, report));

  set(mapEditionsTrackerAtom, (prev) =>
    prev.recordAssetIds(report.touchedAssetIds),
  );

  return report;
}

export function settleAppliedModel(
  hydraulicModel: HydraulicModel,
  stateId: string,
  report: ApplyReport,
): HydraulicModel {
  const updatedHydraulicModel = updateHydraulicModelAssets(hydraulicModel);

  const customerPoints = report.touchedEntities.has("customerPoint")
    ? new CustomerPoints(
        [...hydraulicModel.customerPoints].sort(([a], [b]) => a - b),
      )
    : hydraulicModel.customerPoints;

  const curves = report.touchedEntities.has("curve")
    ? new Map(hydraulicModel.curves)
    : hydraulicModel.curves;

  return {
    ...updatedHydraulicModel,
    version: stateId,
    customerPoints,
    curves,
  };
}
