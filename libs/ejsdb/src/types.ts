import type { AssetRows } from "./schema/assets";
import type { AssetPatchRows } from "./schema/patches";
import type {
  CustomerPointRow,
  CustomerPointDemandRow,
} from "./schema/customer-points";
import type { JunctionDemandRow } from "./schema/junction-demands";
import type { PatternRow } from "./schema/patterns";
import type { CurveRow } from "./schema/curves";
import type { CustomAttributesDataRow } from "./schema/custom-attributes-data";

export type OpenDbResult =
  | { status: "ok"; fileVersion: number; appVersion: number }
  | { status: "migrated"; fileVersion: number; appVersion: number }
  | { status: "too-new"; fileVersion: number; appVersion: number }
  | { status: "corrupt"; errorDetails: string }
  | { status: "internal"; errorDetails: string }
  | {
      status: "migration-failed";
      errorDetails: string;
      fileVersion: number;
      appVersion: number;
    };

export type CustomerPointDemandUpdate = {
  customerPointId: number;
  demands: CustomerPointDemandRow[];
};

export type JunctionDemandUpdate = {
  junctionId: number;
  demands: JunctionDemandRow[];
};

export type CustomAttributesDataSave = {
  upserts: CustomAttributesDataRow[];
  deleteIds: number[];
};

export type ApplyMomentPayload = {
  assetDeleteIds: number[];
  assetUpserts: AssetRows;
  assetPatches: AssetPatchRows;
  customerPointDeleteIds: number[];
  customerPointUpserts: CustomerPointRow[];
  customerPointDemandUpdates: CustomerPointDemandUpdate[];
  junctionDemandUpdates: JunctionDemandUpdate[];
  patternsReplacement: PatternRow[] | null;
  curvesReplacement: CurveRow[] | null;
  rawControlsReplacement: string | null;
  controlsReplacement: string | null;
  customAttributesData: CustomAttributesDataSave | null;
};
