import type { AssetType } from "@epanet-js/hydraulic-model";
import type { TranslateFn } from "src/hooks/use-translate";
import type { PanelTemplate } from "src/panels/panel-template";
import { AssetDataTable } from "./asset-data-table";
import { CustomerPointDataTable } from "./customer-point-data-table";

const assetTypeLabelKeys: Record<AssetType, string> = {
  junction: "junctions",
  reservoir: "reservoirs",
  tank: "tanks",
  pipe: "pipes",
  pump: "pumps",
  valve: "valves",
};

export const assetTablePanel: PanelTemplate<"asset-table"> = {
  component: ({ panel }) => <AssetDataTable assetType={panel.assetType} />,
  buildLabel: (panel, translate: TranslateFn) =>
    translate(assetTypeLabelKeys[panel.assetType]),
  onClose: ({ userTracking }, panel) => {
    userTracking.capture({
      name: "dataTables.panelClosed",
      source: "tab",
      panelType: panel.type,
      assetType: panel.assetType,
    });
  },
};

export const customerPointTablePanel: PanelTemplate<"customer-point-table"> = {
  component: () => <CustomerPointDataTable />,
  buildLabel: (_instance, translate: TranslateFn) =>
    translate("customerPoints"),
  onClose: ({ userTracking }, panel) => {
    userTracking.capture({
      name: "dataTables.panelClosed",
      source: "tab",
      panelType: panel.type,
    });
  },
};
