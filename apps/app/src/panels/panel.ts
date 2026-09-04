import { nanoid } from "nanoid";
import type { AssetType } from "@epanet-js/hydraulic-model";
import type { Dock } from "./docks";

type Common = {
  id: string;
  closable: boolean;
  initialDock: Dock;
  availableInVerticalLayout: boolean;
};

export type Panel =
  | (Common & { type: "asset-table"; assetType: AssetType })
  | (Common & { type: "customer-point-table" })
  | (Common & { type: "hgl-profile" });

export type PanelType = Panel["type"];

export type PanelOfType<T extends PanelType> = Extract<Panel, { type: T }>;

export const newPanelId = (): string => nanoid();
