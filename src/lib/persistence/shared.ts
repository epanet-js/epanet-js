import { IWrappedFeature, IFolder } from "src/types";
import { fMoment, Moment, MomentInput } from "./moment";
import { Data } from "src/state/jotai";
import { isDebugOn } from "src/infra/debug-mode";
import { HydraulicModel, ModelMoment } from "src/hydraulic-model";

// This  used to send to posthog, but now could be removed
// or wired into your own product analytics.
export function trackMomentDeprecated(partialMoment: Partial<MomentInput>) {
  const { track } = partialMoment;
  if (isDebugOn) {
    // eslint-disable-next-line no-console
    console.log("TRANSACT_DEPRECATED", JSON.stringify(partialMoment));
  }
  if (track) {
    delete partialMoment.track;
  }
}

export function trackMoment(moment: ModelMoment) {
  if (isDebugOn) {
    // eslint-disable-next-line no-console
    console.log("TRANSACT", JSON.stringify(moment));
  }
}
/**
 * Same as momentForDeleteFolders but for features:
 * create an undelete operation.
 *
 * @param features The folders to delete by ID
 * @param hydraulicModel The hydraulic model
 * @returns a moment with an undelete
 */
export function momentForDeleteFeatures(
  features: readonly IWrappedFeature["id"][],
  hydraulicModel: HydraulicModel,
): Moment {
  const moment = fMoment("Update features");
  for (const id of features) {
    const feature = hydraulicModel.assets.get(id);
    if (feature) {
      moment.putAssets.push(feature);
    }
  }
  return moment;
}

function getLastAtInMap(map: Map<unknown, IFolder | IWrappedFeature>): string {
  let lastAt = "a0";
  for (const val of map.values()) {
    lastAt = val.at;
  }
  return lastAt;
}

/**
 * Get the last known at value from
 * a state ctx. This takes O(n) wrt length of both
 * arrays. It would be nice for the design to eliminate
 * the need for this by keeping things sorted. That is a big TODO.
 *
 * @param ctx
 * @param hydraulicModel
 * @returns the last at, or a0
 */
export function getFreshAt(ctx: Data, hydraulicModel: HydraulicModel): string {
  const a = getLastAtInMap(hydraulicModel.assets);
  const b = getLastAtInMap(ctx.folderMap);
  return a > b ? a : b;
}
