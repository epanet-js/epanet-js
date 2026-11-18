import type { AssetId } from "@epanet-js/hydraulic-model";
import { newPanelId, type PanelOfType } from "src/panels/panel";

export const createSensorsPanel = ({
  id = newPanelId(),
  assetIds,
}: {
  id?: string;
  assetIds?: readonly AssetId[];
} = {}): PanelOfType<"sensors"> => ({
  id,
  type: "sensors",
  initialDock: "bottom",
  availableInVerticalLayout: true,
  closable: true,
  ...(assetIds ? { assetIds } : {}),
});
