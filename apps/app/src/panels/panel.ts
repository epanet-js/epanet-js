import { nanoid } from "nanoid";
import type { AssetId, AssetType, ZoneId } from "@epanet-js/hydraulic-model";
import type { HorizontalDock } from "./docks";

type Common = {
  id: string;
  closable: boolean;
  initialDock: HorizontalDock;
  availableInVerticalLayout: boolean;
};

export type Panel =
  | (Common & {
      type: "asset-table";
      assetType: AssetType;
      assetIds?: readonly AssetId[];
    })
  | (Common & {
      type: "customer-point-table";
      customerPointIds?: readonly number[];
    })
  | (Common & {
      type: "zone-table";
      zoneIds?: readonly ZoneId[];
    })
  | (Common & { type: "hgl-profile" })
  | (Common & { type: "network-review" })
  | (Common & { type: "collections" })
  | (Common & { type: "asset" })
  | (Common & { type: "map-styling" })
  | (Common & { type: "scripts" })
  | (Common & { type: "script-output" });

export type PanelType = Panel["type"];

export type PanelOfType<T extends PanelType> = Extract<Panel, { type: T }>;

export const newPanelId = (): string => nanoid();

export const panelTrackingName = (panel: Panel): string => {
  switch (panel.type) {
    case "asset-table":
      return [
        panel.type,
        panel.assetType,
        panel.assetIds ? "selection" : "all",
      ].join(":");
    case "customer-point-table":
      return [panel.type, panel.customerPointIds ? "selection" : "all"].join(
        ":",
      );
    case "zone-table":
      return [panel.type, panel.zoneIds ? "selection" : "all"].join(":");
    default:
      return panel.type;
  }
};
