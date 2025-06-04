import { Demands } from "src/hydraulic-model/demands";
import type { IWrappedFeature, IWrappedFeatureInput } from "src/types";

/**
 * An entry in history, an 'undo' or a 'redo'.
 * Which direction it is isn't contained here,
 * but in whether it's in the undo or redo side
 * of a MomentLog.
 */
export interface Moment {
  note?: string;
  putAssets: IWrappedFeature[];
  deleteAssets: IWrappedFeature["id"][];
}

// This was previously posthog properties,
// is now just an unknown.
type Properties = any;

export interface MomentInput {
  note?: string;
  track?: string | [string, Properties];
  putAssets: IWrappedFeatureInput[];
  putDemands?: Demands;
  deleteAssets: IWrappedFeature["id"][];
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
  };
}

export const EMPTY_MOMENT: Moment = {
  putAssets: [],
  deleteAssets: [],
};

export const OPPOSITE = {
  undo: "redo",
  redo: "undo",
} as const;

class CUMoment {
  merge(...moments: Moment[]) {
    const first = moments[0];

    const dst: Moment = {
      note: first.note,
      putAssets: first.putAssets.slice(),
      deleteAssets: first.deleteAssets.slice(),
    };

    for (const moment of moments.slice(1)) {
      dst.putAssets = dst.putAssets.concat(moment.putAssets);
      dst.deleteAssets = dst.deleteAssets.concat(moment.deleteAssets);
    }

    return dst;
  }

  /**
   * Does this moment contain nothing?
   * Make sure to update this whenever moments get new arrays!
   */
  isEmpty(moment: Moment) {
    return moment.putAssets.length === 0 && moment.deleteAssets.length === 0;
  }
}

export const UMoment = new CUMoment();
