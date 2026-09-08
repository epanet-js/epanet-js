import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import type { AssetType } from "@epanet-js/hydraulic-model";
import type { Panel } from "src/panels/panel";
import {
  createAssetTablePanel,
  createCustomerPointTablePanel,
} from "src/panels/data-tables/create-panel";
import { splitsAtom } from "src/state/layout";
import { panelsAtom } from "src/state/panels";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection";
import { useUserTracking } from "src/infra/user-tracking";
import { useActivatePanel } from "./activate-panel";

export const CUSTOMER_POINTS_TABLE = "customerPoints";

export type DataTableType = AssetType | typeof CUSTOMER_POINTS_TABLE;

export type DataTableScope = "all" | "selection";

export type OpenDataTablesRequest = {
  tableTypes: readonly DataTableType[];
  scope?: DataTableScope;
};

export const useOpenDataTables = () => {
  const setPanels = useSetAtom(panelsAtom);
  const setSplits = useSetAtom(splitsAtom);
  const selection = useAtomValue(selectionAtom);
  const activatePanel = useActivatePanel();
  const userTracking = useUserTracking();

  return useCallback(
    ({ tableTypes, scope = "all" }: OpenDataTablesRequest) => {
      if (tableTypes.length === 0) return;

      const selectedIdsFor = (tableType: DataTableType) =>
        tableType === CUSTOMER_POINTS_TABLE
          ? [...USelection.getCustomerPointIds(selection)]
          : [...USelection.getAssetIds(selection)];

      const created: Panel[] = [];

      for (const tableType of tableTypes) {
        const ids =
          scope === "selection" ? selectedIdsFor(tableType) : undefined;

        created.push(
          tableType === CUSTOMER_POINTS_TABLE
            ? createCustomerPointTablePanel({ customerPointIds: ids })
            : createAssetTablePanel(tableType, { assetIds: ids }),
        );
      }

      if (created.length > 0) {
        setPanels((prev) => [...prev, ...created]);
        setSplits((splits) => ({ ...splits, bottomOpen: true }));
        activatePanel(created[0].id);
      }

      userTracking.capture({
        name: "dataTables.opened",
        source: "picker",
        scope,
        opened: created.length,
        requested: tableTypes.length,
      });
    },
    [userTracking, selection, setPanels, setSplits, activatePanel],
  );
};
