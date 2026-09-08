import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import type { AssetType } from "@epanet-js/hydraulic-model";
import type { Panel } from "src/panels/panel";
import {
  createAssetTablePanel,
  createCustomerPointTablePanel,
} from "src/panels/data-tables/create-panel";
import { panelsAtom } from "src/state/panels";
import { useUserTracking } from "src/infra/user-tracking";
import { useActivatePanel } from "./activate-panel";

export type OpenDataTablesRequest = {
  assetTypes: readonly AssetType[];
  includeCustomerPoints: boolean;
};

const isSameTable = (panel: Panel, assetType: AssetType | null): boolean =>
  assetType === null
    ? panel.type === "customer-point-table"
    : panel.type === "asset-table" && panel.assetType === assetType;

export const useOpenDataTables = () => {
  const panels = useAtomValue(panelsAtom);
  const setPanels = useSetAtom(panelsAtom);
  const activatePanel = useActivatePanel();
  const userTracking = useUserTracking();

  return useCallback(
    ({ assetTypes, includeCustomerPoints }: OpenDataTablesRequest) => {
      const requested: (AssetType | null)[] = [
        ...assetTypes,
        ...(includeCustomerPoints ? [null] : []),
      ];
      if (requested.length === 0) return;

      const created: Panel[] = [];
      const firstId = (() => {
        let first: string | undefined;
        for (const assetType of requested) {
          const existing = panels.find((panel) =>
            isSameTable(panel, assetType),
          );
          if (existing) {
            first ??= existing.id;
            continue;
          }
          const panel =
            assetType === null
              ? createCustomerPointTablePanel()
              : createAssetTablePanel(assetType);
          created.push(panel);
          first ??= panel.id;
        }
        return first;
      })();

      if (created.length > 0) setPanels((prev) => [...prev, ...created]);
      if (firstId) activatePanel(firstId);

      userTracking.capture({
        name: "dataTables.opened",
        source: "picker",
        opened: created.length,
        requested: requested.length,
      });
    },
    [panels, setPanels, activatePanel, userTracking],
  );
};
