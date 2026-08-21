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

export function applyMoment(
  get: Getter,
  set: Setter,
  stateId: string,
  forwardMoment: Moment,
  modelAtom: WritableAtom<HydraulicModel, [HydraulicModel], void>,
): Moment {
  const hydraulicModel = get(modelAtom);

  const processedMoment: Moment = {
    ...forwardMoment,
    note: forwardMoment.note || "Update",
    putAssets: ensureAtValues(forwardMoment.putAssets, hydraulicModel),
  };

  const factories = get(modelFactoriesAtom);
  const reverseMoment = applyMomentToModel(
    hydraulicModel,
    processedMoment,
    factories.labelManager,
  );

  const updatedHydraulicModel = updateHydraulicModelAssets(hydraulicModel);

  const updatedCustomerPoints =
    (forwardMoment.putCustomerPoints || []).length > 0 ||
    (forwardMoment.deleteCustomerPoints || []).length > 0
      ? new CustomerPoints(
          [...hydraulicModel.customerPoints].sort(([a], [b]) => a - b),
        )
      : hydraulicModel.customerPoints;

  const updatedCurves =
    forwardMoment.putCurves && forwardMoment.putCurves.size > 0
      ? new Map(hydraulicModel.curves)
      : hydraulicModel.curves;

  set(modelAtom, {
    ...updatedHydraulicModel,
    version: stateId,
    customerPoints: updatedCustomerPoints,
    curves: updatedCurves,
  });

  set(mapEditionsTrackerAtom, (prev) => prev.record(processedMoment));

  return reverseMoment;
}

export type HistoryAction = { moment: Moment; stateId: string };

export function prepareHistoryAction(
  action: HistoryAction,
): Promise<HistoryAction> {
  return Promise.resolve(action);
}
