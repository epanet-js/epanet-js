import type { AssetId, AssetType, ZoneId } from "@epanet-js/hydraulic-model";
import { type PanelOfType, newPanelId } from "src/panels/panel";

export const createAssetTablePanel = (
  assetType: AssetType,
  {
    id = newPanelId(),
    closable = true,
    assetIds,
  }: { id?: string; closable?: boolean; assetIds?: readonly AssetId[] } = {},
): PanelOfType<"asset-table"> => ({
  id,
  type: "asset-table",
  assetType,
  initialDock: "bottom",
  availableInVerticalLayout: true,
  closable,
  ...(assetIds ? { assetIds } : {}),
});

export const createCustomerPointTablePanel = ({
  id = newPanelId(),
  closable = true,
  customerPointIds,
}: {
  id?: string;
  closable?: boolean;
  customerPointIds?: readonly number[];
} = {}): PanelOfType<"customer-point-table"> => ({
  id,
  type: "customer-point-table",
  initialDock: "bottom",
  availableInVerticalLayout: true,
  closable,
  ...(customerPointIds ? { customerPointIds } : {}),
});

export const createZoneTablePanel = ({
  id = newPanelId(),
  closable = true,
  zoneIds,
}: {
  id?: string;
  closable?: boolean;
  zoneIds?: readonly ZoneId[];
} = {}): PanelOfType<"zone-table"> => ({
  id,
  type: "zone-table",
  initialDock: "bottom",
  availableInVerticalLayout: true,
  closable,
  ...(zoneIds ? { zoneIds } : {}),
});

const DEFAULT_ASSET_TYPES: AssetType[] = [
  "junction",
  "pipe",
  "pump",
  "valve",
  "reservoir",
  "tank",
];

export const OPENABLE_ASSET_TYPES: readonly AssetType[] = DEFAULT_ASSET_TYPES;
