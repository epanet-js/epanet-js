import type { QuantityProperty } from "@epanet-js/project-settings";
import type {
  QuickGraphAssetType,
  QuickGraphPropertyByAssetType,
} from "./types";

export const QUICK_GRAPH_PROPERTIES: {
  [K in QuickGraphAssetType]: {
    value: QuickGraphPropertyByAssetType[K];
    labelKey: string;
    quantityKey: QuantityProperty;
  }[];
} = {
  junction: [
    { value: "pressure", labelKey: "pressure", quantityKey: "pressure" },
    { value: "head", labelKey: "head", quantityKey: "head" },
    { value: "demand", labelKey: "actualDemand", quantityKey: "actualDemand" },
  ],
  pipe: [
    { value: "flow", labelKey: "flow", quantityKey: "flow" },
    { value: "velocity", labelKey: "velocity", quantityKey: "velocity" },
    {
      value: "headloss",
      labelKey: "unitHeadloss",
      quantityKey: "unitHeadloss",
    },
  ],
  pump: [
    { value: "flow", labelKey: "flow", quantityKey: "flow" },
    { value: "head", labelKey: "pumpHead", quantityKey: "head" },
    {
      value: "setting",
      labelKey: "pump.relativeSpeedSetting",
      quantityKey: "speed",
    },
    { value: "status", labelKey: "status", quantityKey: "status" },
  ],
  valve: [
    { value: "flow", labelKey: "flow", quantityKey: "flow" },
    { value: "velocity", labelKey: "velocity", quantityKey: "velocity" },
    { value: "headloss", labelKey: "headlossShort", quantityKey: "headloss" },
    { value: "setting", labelKey: "setting", quantityKey: "tcvSetting" },
  ],
  tank: [
    { value: "level", labelKey: "level", quantityKey: "level" },
    { value: "volume", labelKey: "volume", quantityKey: "volume" },
    { value: "netFlow", labelKey: "netFlow", quantityKey: "netFlow" },
    { value: "pressure", labelKey: "pressure", quantityKey: "pressure" },
    { value: "head", labelKey: "head", quantityKey: "head" },
  ],
  reservoir: [
    { value: "pressure", labelKey: "pressure", quantityKey: "pressure" },
    { value: "head", labelKey: "head", quantityKey: "head" },
    { value: "netFlow", labelKey: "netFlow", quantityKey: "netFlow" },
  ],
};
