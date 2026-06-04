import { IWrappedFeature } from "src/types";
import { isDebugOn } from "src/infra/debug-mode";
import { HydraulicModel, ModelMoment } from "src/hydraulic-model";

export function trackMoment(moment: ModelMoment) {
  if (isDebugOn) {
    // eslint-disable-next-line no-console
    console.log(
      "TRANSACT",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      JSON.stringify(moment, (_, v) => (v === undefined ? "__undefined__" : v)),
    );
  }
}

function getLastAtInMap(map: Map<unknown, IWrappedFeature>): string {
  let lastAt = "a0";
  for (const val of map.values()) {
    lastAt = val.at;
  }
  return lastAt;
}

/**
 * Get the last known at value from the hydraulic model assets.
 *
 * @param hydraulicModel
 * @returns the last at, or a0
 */
export function getFreshAt(hydraulicModel: HydraulicModel): string {
  return getLastAtInMap(hydraulicModel.assets);
}
