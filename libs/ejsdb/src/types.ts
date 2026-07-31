import type { AssetRows } from "./schema/assets";
import type { AssetPatchRows, CustomerPointPatchRow } from "./schema/patches";
import type {
  CustomerPointRow,
  CustomerPointDemandRow,
  CustomerPointsData,
} from "./schema/customer-points";
import type { JunctionDemandRow } from "./schema/junction-demands";
import type { PatternRow } from "./schema/patterns";
import type { CurveRow } from "./schema/curves";
import type { ZoneRow } from "./schema/zones";

export type NewDbResult =
  | { status: "ok" }
  | { status: "storage-error"; errorDetails: string };

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

export type CustomAttributeValueUpdate = {
  id: number;
  delta: string;
};

export type AssetCustomAttributeUpdates = {
  junctions: CustomAttributeValueUpdate[];
  reservoirs: CustomAttributeValueUpdate[];
  tanks: CustomAttributeValueUpdate[];
  pipes: CustomAttributeValueUpdate[];
  pumps: CustomAttributeValueUpdate[];
  valves: CustomAttributeValueUpdate[];
};

export const emptyAssetCustomAttributeUpdates =
  (): AssetCustomAttributeUpdates => ({
    junctions: [],
    reservoirs: [],
    tanks: [],
    pipes: [],
    pumps: [],
    valves: [],
  });

export type ImportProjectPayload = {
  newDb: boolean;
  projectSettings: string | null;
  pipeLibrary: string | null;
  zones: ZoneRow[] | null;
  assets: AssetRows;
  customerPoints: CustomerPointsData;
  patterns: PatternRow[];
  curves: CurveRow[];
  rawControls: string;
  controls: string;
  simulationSettings: string;
  junctionDemands: JunctionDemandRow[];
};

export type ApplyMomentPayload = {
  assetDeleteIds: number[];
  assetUpserts: AssetRows;
  assetPatches: AssetPatchRows;
  customerPointDeleteIds: number[];
  customerPointUpserts: CustomerPointRow[];
  customerPointPatches: CustomerPointPatchRow[];
  customerPointDemandUpdates: CustomerPointDemandUpdate[];
  junctionDemandUpdates: JunctionDemandUpdate[];
  patternsReplacement: PatternRow[] | null;
  curvesReplacement: CurveRow[] | null;
  rawControlsReplacement: string | null;
  controlsReplacement: string | null;
  customAttributesDefinition: string | null;
  customAttributeValues: AssetCustomAttributeUpdates;
  customerPointCustomAttributeValues: CustomAttributeValueUpdate[];
};
