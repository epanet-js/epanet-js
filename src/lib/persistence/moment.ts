import { Demands } from "src/hydraulic-model/demands";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { Curves } from "src/hydraulic-model/curves";
import { EPSTiming } from "src/hydraulic-model/eps-timing";
import { Controls } from "src/hydraulic-model/controls";
import type { AssetPatch } from "src/hydraulic-model/model-operation";
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
  patchAssetsAttributes: AssetPatch[];
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
  deleteAssets: IWrappedFeature["id"][];
  patchAssetsAttributes: AssetPatch[];
  putDemands?: Demands;
  putEPSTiming?: EPSTiming;
  putControls?: Controls;
  putCustomerPoints?: CustomerPoint[];
  putCurves?: Curves;
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
