import type { AssetType } from "@epanet-js/hydraulic-model";
import type { TranslateFn } from "src/hooks/use-translate";
import { tableHandlesAtom } from "./table-handles";
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
  component: ({ panel }) => (
    <AssetDataTable
      id={panel.id}
      type={panel.type}
      assetType={panel.assetType}
    />
  ),
  onDeactivate: ({ get }, panel) =>
    get(tableHandlesAtom)[panel.id]?.captureState(),
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
  component: ({ panel }) => (
    <CustomerPointDataTable id={panel.id} type={panel.type} />
  ),
  onDeactivate: ({ get }, panel) =>
    get(tableHandlesAtom)[panel.id]?.captureState(),
  buildLabel: (_panel, translate: TranslateFn) => translate("customerPoints"),
  onClose: ({ userTracking }, panel) => {
    userTracking.capture({
      name: "dataTables.panelClosed",
      source: "tab",
      panelType: panel.type,
    });
  },
};
