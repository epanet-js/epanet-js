import { Demands } from "src/hydraulic-model/demands";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { Curves } from "src/hydraulic-model/curves";
import { EPSTiming } from "src/hydraulic-model/eps-timing";
import { Controls } from "src/hydraulic-model/controls";
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
  putDemands?: Demands;
  putEPSTiming?: EPSTiming;
  putControls?: Controls;
  putCustomerPoints?: CustomerPoint[];
  putCurves?: Curves;
}

// This was previously posthog properties,
// is now just an unknown.
type Properties = any;

export interface MomentInput {
  note?: string;
  track?: string | [string, Properties];
  putAssets: IWrappedFeatureInput[];
  putDemands?: Demands;
  putEPSTiming?: EPSTiming;
  putControls?: Controls;
  putCustomerPoints?: CustomerPoint[];
  putCurves?: Curves;
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
      putDemands: first.putDemands,
      putCustomerPoints: first.putCustomerPoints?.slice() || [],
      putCurves: first.putCurves,
    };

    for (const moment of moments.slice(1)) {
      dst.putAssets = dst.putAssets.concat(moment.putAssets);
      dst.deleteAssets = dst.deleteAssets.concat(moment.deleteAssets);
      if (moment.putDemands) {
        dst.putDemands = moment.putDemands;
      }
      if (moment.putCustomerPoints) {
        dst.putCustomerPoints = (dst.putCustomerPoints || []).concat(
          moment.putCustomerPoints,
        );
      }
      if (moment.putCurves) {
        dst.putCurves = moment.putCurves;
      }
    }

    return dst;
  }

  /**
   * Does this moment contain nothing?
   * Make sure to update this whenever moments get new arrays!
   */
  isEmpty(moment: Moment) {
    return (
      moment.putAssets.length === 0 &&
      moment.deleteAssets.length === 0 &&
      !moment.putDemands &&
      (!moment.putCustomerPoints || moment.putCustomerPoints.length === 0) &&
      !moment.putCurves
    );
  }
}

export const UMoment = new CUMoment();
