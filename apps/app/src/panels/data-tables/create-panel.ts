import type { AssetType } from "@epanet-js/hydraulic-model";
import { type PanelOfType, newPanelId } from "src/panels/panel";

export const createAssetTablePanel = (
  assetType: AssetType,
  { id = newPanelId(), closable = true } = {},
): PanelOfType<"asset-table"> => ({
  id,
  type: "asset-table",
  assetType,
  initialDock: "bottom",
  availableInVerticalLayout: true,
  closable,
});

export const createCustomerPointTablePanel = ({
  id = newPanelId(),
  closable = true,
} = {}): PanelOfType<"customer-point-table"> => ({
  id,
  type: "customer-point-table",
  initialDock: "bottom",
  availableInVerticalLayout: true,
  closable,
});

const DEFAULT_ASSET_TYPES: AssetType[] = [
  "junction",
  "pipe",
  "pump",
  "valve",
  "reservoir",
  "tank",
];

export const defaultDataTablePanels = () => [
  ...DEFAULT_ASSET_TYPES.map((assetType) =>
    createAssetTablePanel(assetType, { id: assetType, closable: false }),
  ),
  createCustomerPointTablePanel({ id: "customer-point", closable: false }),
];
