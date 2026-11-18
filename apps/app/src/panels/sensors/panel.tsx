import { SensorsIcon } from "src/icons";
import { panelTrackingName } from "src/panels/panel";
import type { PanelTemplate } from "src/panels/panel-template";
import { tableHandlesAtom } from "src/panels/data-tables/table-handles";
import { SensorsPanel } from "./sensors-panel";

export const sensorsPanel: PanelTemplate<"sensors"> = {
  component: ({ panel }) => (
    <SensorsPanel panelId={panel.id} assetIds={panel.assetIds} />
  ),
  buildLabel: (_panel, { translate }) => translate("sensorData.panel.title"),
  icon: () => <SensorsIcon />,
  buildDescription: (panel, { sensors }) => {
    if (!panel.assetIds) return undefined;
    const scope = new Set(panel.assetIds);
    const count = sensors.filter(({ assetId }) => scope.has(assetId)).length;
    return `(${count.toLocaleString()})`;
  },
  onDeactivate: ({ get }, panel) =>
    get(tableHandlesAtom)[panel.id]?.captureState(),
  onClose: ({ userTracking }, panel) => {
    userTracking.capture({
      name: "dataTables.closed",
      source: "tab",
      panelType: panelTrackingName(panel),
    });
  },
};
