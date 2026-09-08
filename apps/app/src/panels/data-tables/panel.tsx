import type { AssetType } from "@epanet-js/hydraulic-model";
import { tableHandlesAtom } from "./table-handles";
import type { PanelTemplate } from "src/panels/panel-template";
import { AssetDataTable } from "./asset-data-table";
import { CustomerPointDataTable } from "./customer-point-data-table";
import { TablePicker } from "./table-picker";

const countMatching = <T,>(ids: readonly T[], matches: (id: T) => boolean) =>
  ids.reduce((count, id) => (matches(id) ? count + 1 : count), 0);

const assetTypeLabelKeys: Record<AssetType, string> = {
  junction: "junctions",
  reservoir: "reservoirs",
  tank: "tanks",
  pipe: "pipes",
  pump: "pumps",
  valve: "valves",
};

const scopedLabel = (label: string, rowCount: number | undefined) =>
  rowCount === undefined ? label : `${label} (${rowCount.toLocaleString()})`;

export const assetTablePanel: PanelTemplate<"asset-table"> = {
  component: ({ panel }) => (
    <AssetDataTable
      id={panel.id}
      type={panel.type}
      assetType={panel.assetType}
      assetIds={panel.assetIds}
    />
  ),
  onDeactivate: ({ get }, panel) =>
    get(tableHandlesAtom)[panel.id]?.captureState(),
  buildLabel: (panel, { translate, hydraulicModel }) =>
    scopedLabel(
      translate(assetTypeLabelKeys[panel.assetType]),
      panel.assetIds &&
        countMatching(
          panel.assetIds,
          (assetId) =>
            hydraulicModel.assets.get(assetId)?.type === panel.assetType,
        ),
    ),
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
    <CustomerPointDataTable
      id={panel.id}
      type={panel.type}
      customerPointIds={panel.customerPointIds}
    />
  ),
  onDeactivate: ({ get }, panel) =>
    get(tableHandlesAtom)[panel.id]?.captureState(),
  buildLabel: (panel, { translate, hydraulicModel }) =>
    scopedLabel(
      translate("customerPoints"),
      panel.customerPointIds &&
        countMatching(panel.customerPointIds, (customerPointId) =>
          hydraulicModel.customerPoints.has(customerPointId),
        ),
    ),
  onClose: ({ userTracking }, panel) => {
    userTracking.capture({
      name: "dataTables.panelClosed",
      source: "tab",
      panelType: panel.type,
    });
  },
};

export const tablePickerPanel: PanelTemplate<"table-picker"> = {
  component: ({ panel }) => <TablePicker id={panel.id} />,
  buildLabel: (_panel, { translate }) => translate("dataTables.picker.title"),
};
