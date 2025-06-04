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
  putFeatures: IWrappedFeature[];
  deleteFeatures: IWrappedFeature["id"][];
}

// This was previously posthog properties,
// is now just an unknown.
type Properties = any;

export interface MomentInput {
  note?: string;
  track?: string | [string, Properties];
  putFeatures: IWrappedFeatureInput[];
  putDemands?: Demands;
  deleteFeatures: IWrappedFeature["id"][];
  skipMomentLog?: boolean;
}

/**
 * Factory method (f) to generate moments.
 */
export function fMoment(note?: string): Moment {
  return {
    note,
    putFeatures: [],
    deleteFeatures: [],
  };
}

export const EMPTY_MOMENT: Moment = {
  putFeatures: [],
  deleteFeatures: [],
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
      putFeatures: first.putFeatures.slice(),
      deleteFeatures: first.deleteFeatures.slice(),
    };

    for (const moment of moments.slice(1)) {
      dst.putFeatures = dst.putFeatures.concat(moment.putFeatures);
      dst.deleteFeatures = dst.deleteFeatures.concat(moment.deleteFeatures);
    }

    return dst;
  }

  /**
   * Does this moment contain nothing?
   * Make sure to update this whenever moments get new arrays!
   */
  isEmpty(moment: Moment) {
    return (
      moment.putFeatures.length === 0 && moment.deleteFeatures.length === 0
    );
  }
}

export const UMoment = new CUMoment();
