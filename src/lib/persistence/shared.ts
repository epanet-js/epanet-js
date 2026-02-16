import { IWrappedFeature, IFolder } from "src/types";
import { Data } from "src/state/jotai";
import { isDebugOn } from "src/infra/debug-mode";
import { HydraulicModel, ModelMoment } from "src/hydraulic-model";

export function trackMoment(moment: ModelMoment) {
  if (isDebugOn) {
    // eslint-disable-next-line no-console
    console.log("TRANSACT", JSON.stringify(moment));
  }
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
