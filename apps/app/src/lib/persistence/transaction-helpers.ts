import once from "lodash/once";
import { generateKeyBetween } from "fractional-indexing";
import type { Getter, Setter, WritableAtom } from "jotai";
import {
  type HydraulicModel,
  type Asset,
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
