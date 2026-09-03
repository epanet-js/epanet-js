import once from "lodash/once";
import { generateKeyBetween } from "fractional-indexing";
import type { Getter, Setter, WritableAtom } from "jotai";
import {
  type HydraulicModel,
  type Asset,
  updateHydraulicModelAssets,
  applyMomentToModel,
} from "src/hydraulic-model";
import { CustomerPoints } from "@epanet-js/hydraulic-model";
import type { ChangeSet } from "@epanet-js/change-set";
import {
  applyChangeSet,
  type ApplyReport,
  type Direction,
} from "src/hydraulic-model/change-sets";
import { modelFactoriesAtom } from "src/state/model-factories";
import { mapEditionsTrackerAtom } from "src/state/map";
import type { Moment } from "./moment";
import { getFreshAt } from "./shared";

export function ensureAtValues(
  features: Asset[] | undefined,
  hydraulicModel: HydraulicModel,
): Asset[] {
  if (!features || features.length === 0) return [];

  const ats = once(() =>
    Array.from(hydraulicModel.assets.values(), (wrapped) => wrapped.at).sort(),
  );
  const atsSet = once(() => new Set(ats()));

  let lastAt: string | null = null;

  for (const inputFeature of features) {
    const mutable = inputFeature as { at: string };
    const isNew = !hydraulicModel.assets.has(inputFeature.id);

    if (inputFeature.at === undefined) {
      if (!lastAt) lastAt = getFreshAt(hydraulicModel);
      const at = generateKeyBetween(lastAt, null);
      lastAt = at;
      mutable.at = at;
    }

    if (isNew && atsSet().has(inputFeature.at)) {
      mutable.at = generateKeyBetween(null, ats()[0]);
    }
  }

  return features;
}

export function processMoment(
  moment: Moment,
  hydraulicModel: HydraulicModel,
): Moment {
  return {
    ...moment,
    note: moment.note || "Update",
    putAssets: ensureAtValues(moment.putAssets, hydraulicModel),
  };
}

export function applyMoment(
  get: Getter,
  set: Setter,
  stateId: string,
  forwardMoment: Moment,
  modelAtom: WritableAtom<HydraulicModel, [HydraulicModel], void>,
): Moment {
  const hydraulicModel = get(modelAtom);

  const processedMoment = processMoment(forwardMoment, hydraulicModel);

  const factories = get(modelFactoriesAtom);
  const reverseMoment = applyMomentToModel(
    hydraulicModel,
    processedMoment,
    factories.labelManager,
  );

  commitModel(set, stateId, hydraulicModel, modelAtom, {
    rebuildCustomerPoints:
      (forwardMoment.putCustomerPoints || []).length > 0 ||
      (forwardMoment.deleteCustomerPoints || []).length > 0,
    rebuildCurves: Boolean(
      forwardMoment.putCurves && forwardMoment.putCurves.size > 0,
    ),
  });

  set(mapEditionsTrackerAtom, (prev) => prev.record(processedMoment));

  return reverseMoment;
}

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

  commitModel(set, stateId, hydraulicModel, modelAtom, {
    rebuildCustomerPoints: report.touchedEntities.has("customerPoint"),
    rebuildCurves: report.touchedEntities.has("curve"),
  });

  set(mapEditionsTrackerAtom, (prev) =>
    prev.recordAssetIds(report.touchedAssetIds),
  );

  return report;
}

function commitModel(
  set: Setter,
  stateId: string,
  hydraulicModel: HydraulicModel,
  modelAtom: WritableAtom<HydraulicModel, [HydraulicModel], void>,
  {
    rebuildCustomerPoints,
    rebuildCurves,
  }: { rebuildCustomerPoints: boolean; rebuildCurves: boolean },
): void {
  const updatedHydraulicModel = updateHydraulicModelAssets(hydraulicModel);

  const customerPoints = rebuildCustomerPoints
    ? new CustomerPoints(
        [...hydraulicModel.customerPoints].sort(([a], [b]) => a - b),
      )
    : hydraulicModel.customerPoints;

  const curves = rebuildCurves
    ? new Map(hydraulicModel.curves)
    : hydraulicModel.curves;

  set(modelAtom, {
    ...updatedHydraulicModel,
    version: stateId,
    customerPoints,
    curves,
  });
}

export type HistoryAction = { moment: Moment; stateId: string };

export function prepareHistoryAction(
  action: HistoryAction,
): Promise<HistoryAction> {
  return Promise.resolve(action);
}
