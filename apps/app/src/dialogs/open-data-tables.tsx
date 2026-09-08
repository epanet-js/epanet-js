import { useCallback, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import type { AssetType } from "@epanet-js/hydraulic-model";
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
  const panels = useAtomValue(panelsAtom);
  const openDataTables = useOpenDataTables();
  const selection = useAtomValue(selectionAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const [checked, setChecked] = useState<ReadonlySet<DataTableType>>(new Set());
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

  const alreadyOpen = useMemo(
    () =>
      new Set(
        choices
          .filter((choice) =>
            panels.some((panel) =>
              choice.tableType === CUSTOMER_POINTS_TABLE
                ? panel.type === "customer-point-table"
                : panel.type === "asset-table" &&
                  panel.assetType === choice.tableType,
            ),
          )
          .map((choice) => choice.tableType),
      ),
    [choices, panels],
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

  const isUnavailable = useCallback(
    (choice: Choice) =>
      scopedToSelection
        ? !selectedCounts.has(choice.tableType)
        : alreadyOpen.has(choice.tableType),
    [scopedToSelection, selectedCounts, alreadyOpen],
  );

  const toggle = useCallback((tableType: DataTableType) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(tableType)) next.delete(tableType);
      else next.add(tableType);
      return next;
    });
  }, []);

  const newlyChecked = choices.filter(
    (choice) => checked.has(choice.tableType) && !isUnavailable(choice),
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
        <p className="text-size-small text-subtle">
          {translate("dataTables.picker.prompt")}
        </p>

        <ul className="flex flex-col gap-1.5">
          {choices.map((choice) => {
            const unavailable = isUnavailable(choice);
            const selectedCount = selectedCounts.get(choice.tableType) ?? 0;
            return (
              <li key={choice.tableType}>
                <label
                  className={`flex items-center gap-2 text-size-base w-max ${
                    unavailable
                      ? "text-disabled cursor-not-allowed"
                      : "text-default cursor-pointer"
                  }`}
                >
                  <Checkbox
                    checked={
                      (unavailable && !scopedToSelection) ||
                      checked.has(choice.tableType)
                    }
                    disabled={unavailable}
                    onChange={() => toggle(choice.tableType)}
                  />
                  {choice.label}
                  {scopedToSelection ? (
                    <span className="text-size-small text-subtle">
                      {selectedCount > 0
                        ? `(${selectedCount.toLocaleString()})`
                        : translate("dataTables.picker.noneSelected")}
                    </span>
                  ) : (
                    unavailable && (
                      <span className="text-size-small text-subtle">
                        {translate("dataTables.picker.alreadyOpen")}
                      </span>
                    )
                  )}
                </label>
              </li>
            );
          })}
        </ul>

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
          {!hasSelection && (
            <span className="text-size-small text-subtle">
              {translate("dataTables.picker.nothingSelected")}
            </span>
          )}
        </label>
      </div>
    </BaseDialog>
  );
};
