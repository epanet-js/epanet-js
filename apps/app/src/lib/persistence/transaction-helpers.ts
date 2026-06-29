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
import { stagingModelAtom, baseModelAtom } from "src/state/hydraulic-model";
import { modelFactoriesAtom } from "src/state/model-factories";
import { worktreeAtom } from "src/state/scenarios";
import { type MomentPointer } from "src/state/map";
import { branchStateAtom } from "src/state/branch-state";
import { customAttributesDataAtom } from "src/state/custom-attributes";
import { applyMomentToCustomAttributes } from "src/lib/custom-attributes/apply-moment";
import type { Moment } from "./moment";
import type { MomentLog } from "./moment-log";
import { getFreshAt } from "./shared";

const MAX_CHANGES_BEFORE_MAP_SYNC = 500;

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
  modelAtom: WritableAtom<
    HydraulicModel,
    [HydraulicModel],
    void
  > = stagingModelAtom,
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

  if (forwardMoment.customAttributes) {
    const { data, reverse } = applyMomentToCustomAttributes(
      get(customAttributesDataAtom),
      forwardMoment.customAttributes,
    );
    set(customAttributesDataAtom, data);
    return { ...reverseMoment, customAttributes: reverse };
  }

  return reverseMoment;
}

export function exceedsMaxChangesSinceLastSync(
  momentLog: MomentLog,
  lastSyncPointer: number,
): boolean {
  const deltasSinceLastSync = momentLog.getDeltas(lastSyncPointer);
  const editedAssetsCount = deltasSinceLastSync.reduce(
    (count, moment) =>
      count +
      (moment.deleteAssets?.length ?? 0) +
      (moment.putAssets?.length ?? 0) +
      (moment.patchAssetsAttributes?.length ?? 0),
    0,
  );
  return editedAssetsCount > MAX_CHANGES_BEFORE_MAP_SYNC;
}

export function computeSyncMoment(
  current: MomentPointer,
  momentLog: MomentLog,
  force: boolean = false,
): MomentPointer {
  if (force || exceedsMaxChangesSinceLastSync(momentLog, current.pointer)) {
    return {
      pointer: momentLog.getPointer(),
      version: current.version + 1,
    };
  }
  return current;
}

export function syncBranchState(
  get: Getter,
  set: Setter,
  momentLog: MomentLog,
  version: string,
): void {
  const worktree = get(worktreeAtom);
  const branchStates = get(branchStateAtom);
  const currentState = branchStates.get(worktree.activeBranchId);
  if (!currentState) return;

  const updatedModel = get(stagingModelAtom);
  const updatedStates = new Map(branchStates);
  updatedStates.set(worktree.activeBranchId, {
    ...currentState,
    hydraulicModel: updatedModel,
    momentLog,
    version,
  });
  set(branchStateAtom, updatedStates);

  if (worktree.activeBranchId === worktree.mainId) {
    set(baseModelAtom, updatedModel);
  }
}
