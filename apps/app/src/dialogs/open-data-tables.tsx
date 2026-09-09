import { useCallback, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import type { AssetType } from "@epanet-js/hydraulic-model";
import {
  BaseMultiSelectorList,
  type SelectorListOption,
} from "@epanet-js/ui-kit";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { Checkbox } from "src/components/form/Checkbox";
import { useTranslate } from "src/hooks/use-translate";
import {
  CUSTOMER_POINTS_TABLE,
  type DataTableType,
  useOpenDataTables,
} from "src/commands/open-data-tables";
import { OPENABLE_ASSET_TYPES } from "src/panels/data-tables/create-panel";
import { panelsAtom } from "src/state/panels";
import { selectionAtom } from "src/state/selection";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { USelection } from "src/selection";

type Choice = { tableType: DataTableType; label: string };

const assetTypeLabelKeys: Record<AssetType, string> = {
  junction: "junctions",
  reservoir: "reservoirs",
  tank: "tanks",
  pipe: "pipes",
  pump: "pumps",
  valve: "valves",
};

export const OpenDataTablesDialog = ({ onClose }: { onClose: () => void }) => {
  const translate = useTranslate();
  const openDataTables = useOpenDataTables();
  const panels = useAtomValue(panelsAtom);
  const selection = useAtomValue(selectionAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const totalCounts = useMemo(() => {
    const counts = new Map<DataTableType, number>();
    for (const asset of hydraulicModel.assets.values()) {
      counts.set(asset.type, (counts.get(asset.type) ?? 0) + 1);
    }
    counts.set(CUSTOMER_POINTS_TABLE, hydraulicModel.customerPoints.size);
    return counts;
  }, [hydraulicModel]);

  const [checked, setChecked] = useState<ReadonlySet<DataTableType>>(() =>
    panels.some(
      (panel) =>
        panel.type === "asset-table" || panel.type === "customer-point-table",
    )
      ? new Set<DataTableType>()
      : new Set(
          [...totalCounts]
            .filter(([, count]) => count > 0)
            .map(([tableType]) => tableType),
        ),
  );
  const [selectedOnly, setSelectedOnly] = useState(false);

  const choices = useMemo<Choice[]>(
    () => [
      ...OPENABLE_ASSET_TYPES.map((assetType) => ({
        tableType: assetType,
        label: translate(assetTypeLabelKeys[assetType]),
      })),
      { tableType: CUSTOMER_POINTS_TABLE, label: translate("customerPoints") },
    ],
    [translate],
  );

  const selectedCounts = useMemo(() => {
    const counts = new Map<DataTableType, number>();
    for (const assetId of USelection.getAssetIds(selection)) {
      const assetType = hydraulicModel.assets.get(assetId)?.type;
      if (!assetType) continue;
      counts.set(assetType, (counts.get(assetType) ?? 0) + 1);
    }
    const customerPoints = USelection.getCustomerPointIds(selection).length;
    if (customerPoints > 0) counts.set(CUSTOMER_POINTS_TABLE, customerPoints);
    return counts;
  }, [selection, hydraulicModel]);

  const hasSelection = selectedCounts.size > 0;
  const scopedToSelection = selectedOnly && hasSelection;

  const toggle = useCallback((tableType: DataTableType) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(tableType)) next.delete(tableType);
      else next.add(tableType);
      return next;
    });
  }, []);

  const options = useMemo<SelectorListOption<DataTableType>[]>(
    () =>
      choices.map((choice) => ({
        value: choice.tableType,
        label: choice.label,
        description: `(${(
          (scopedToSelection ? selectedCounts : totalCounts).get(
            choice.tableType,
          ) ?? 0
        ).toLocaleString()})`,
      })),
    [choices, scopedToSelection, selectedCounts, totalCounts],
  );

  const newlyChecked = choices.filter((choice) =>
    checked.has(choice.tableType),
  );

  const open = useCallback(() => {
    openDataTables({
      tableTypes: newlyChecked.map((choice) => choice.tableType),
      scope: scopedToSelection ? "selection" : "all",
    });
    onClose();
  }, [newlyChecked, scopedToSelection, openDataTables, onClose]);

  return (
    <BaseDialog
      title={translate("dataTables.picker.title")}
      size="sm"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          action={translate("dataTables.picker.open")}
          onAction={open}
          onClose={onClose}
          isDisabled={newlyChecked.length === 0}
        />
      }
    >
      <div className="flex flex-col gap-3 p-4">
        <label
          className={`flex items-center gap-2 text-size-base w-max ${
            hasSelection
              ? "text-default cursor-pointer"
              : "text-disabled cursor-not-allowed"
          }`}
        >
          <Checkbox
            checked={scopedToSelection}
            disabled={!hasSelection}
            onChange={() => setSelectedOnly((prev) => !prev)}
          />
          {translate("dataTables.picker.selectedAssetsOnly")}
        </label>

        <div className="gap-0.5">
          <p className="text-size-base text-subtle font-semibold">
            {translate("dataTables.picker.prompt")}
          </p>

          <div className="border rounded-sm">
            <BaseMultiSelectorList<DataTableType>
              options={options}
              selected={Array.from(checked)}
              onToggle={toggle}
              onClose={onClose}
              maxVisibleOptions={options.length}
              listClassName="text-size-base"
            />
          </div>
        </div>
      </div>
    </BaseDialog>
  );
};
