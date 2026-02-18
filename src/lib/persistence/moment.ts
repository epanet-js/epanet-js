import type {
  AssetPatch,
  OptionalMomentFields,
} from "src/hydraulic-model/model-operation";
import type { IWrappedFeature, IWrappedFeatureInput } from "src/types";

/**
 * An entry in history, an 'undo' or a 'redo'.
 * Which direction it is isn't contained here,
 * but in whether it's in the undo or redo side
 * of a MomentLog.
 */
export interface Moment extends OptionalMomentFields {
  note?: string;
  putAssets: IWrappedFeature[];
  deleteAssets: IWrappedFeature["id"][];
  patchAssetsAttributes: AssetPatch[];
}

// This was previously posthog properties,
// is now just an unknown.
type Properties = any;

export interface MomentInput extends OptionalMomentFields {
  note?: string;
  track?: string | [string, Properties];
  putAssets: IWrappedFeatureInput[];
  deleteAssets: IWrappedFeature["id"][];
  patchAssetsAttributes: AssetPatch[];
  skipMomentLog?: boolean;
}

/**
 * Factory method (f) to generate moments.
 */
export function fMoment(note?: string): Moment {
  return {
    note,
    putAssets: [],
    deleteAssets: [],
    patchAssetsAttributes: [],
  };
}

export const EMPTY_MOMENT: Moment = {
  putAssets: [],
  deleteAssets: [],
  patchAssetsAttributes: [],
};
