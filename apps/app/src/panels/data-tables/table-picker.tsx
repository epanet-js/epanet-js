import { useCallback, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import type { AssetType } from "@epanet-js/hydraulic-model";
import { Button } from "src/components/elements";
import { Checkbox } from "src/components/form/Checkbox";
import { useTranslate } from "src/hooks/use-translate";
import { useClosePanel } from "src/commands/close-panel";
import { useOpenDataTables } from "src/commands/open-data-tables";
import { panelsAtom } from "src/state/panels";
import { OPENABLE_ASSET_TYPES } from "./create-panel";

type Choice = { key: string; label: string; assetType: AssetType | null };

const assetTypeLabelKeys: Record<AssetType, string> = {
  junction: "junctions",
  reservoir: "reservoirs",
  tank: "tanks",
  pipe: "pipes",
  pump: "pumps",
  valve: "valves",
};

export const TablePicker = ({ id }: { id: string }) => {
  const translate = useTranslate();
  const panels = useAtomValue(panelsAtom);
  const openDataTables = useOpenDataTables();
  const closePanel = useClosePanel();
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());

  const choices = useMemo<Choice[]>(
    () => [
      ...OPENABLE_ASSET_TYPES.map((assetType) => ({
        key: assetType,
        label: translate(assetTypeLabelKeys[assetType]),
        assetType,
      })),
      {
        key: "customer-point",
        label: translate("customerPoints"),
        assetType: null,
      },
    ],
    [translate],
  );

  const alreadyOpen = useMemo(
    () =>
      new Set(
        choices
          .filter((choice) =>
            panels.some((panel) =>
              choice.assetType === null
                ? panel.type === "customer-point-table"
                : panel.type === "asset-table" &&
                  panel.assetType === choice.assetType,
            ),
          )
          .map((choice) => choice.key),
      ),
    [choices, panels],
  );

  const toggle = useCallback((key: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const newlyChecked = choices.filter(
    (choice) => checked.has(choice.key) && !alreadyOpen.has(choice.key),
  );

  const open = useCallback(() => {
    openDataTables({
      assetTypes: newlyChecked
        .map((choice) => choice.assetType)
        .filter((assetType): assetType is AssetType => assetType !== null),
      includeCustomerPoints: newlyChecked.some(
        (choice) => choice.assetType === null,
      ),
    });
    closePanel(id);
  }, [newlyChecked, openDataTables, closePanel, id]);

  return (
    <div className="absolute inset-0 flex flex-col gap-3 overflow-auto bg-popover p-4">
      <p className="text-size-small text-subtle">
        {translate("dataTables.picker.prompt")}
      </p>

      <ul className="flex flex-col gap-1.5">
        {choices.map((choice) => {
          const isOpen = alreadyOpen.has(choice.key);
          return (
            <li key={choice.key}>
              <label
                className={`flex items-center gap-2 text-size-base w-max ${
                  isOpen
                    ? "text-disabled cursor-not-allowed"
                    : "text-default cursor-pointer"
                }`}
              >
                <Checkbox
                  checked={isOpen || checked.has(choice.key)}
                  disabled={isOpen}
                  onChange={() => toggle(choice.key)}
                />
                {choice.label}
                {isOpen && (
                  <span className="text-size-small text-subtle">
                    {translate("dataTables.picker.alreadyOpen")}
                  </span>
                )}
              </label>
            </li>
          );
        })}
      </ul>

      <label className="flex items-center gap-2 text-size-base w-max text-disabled cursor-not-allowed">
        <Checkbox checked={false} disabled onChange={() => {}} />
        {translate("dataTables.picker.selectedAssetsOnly")}
      </label>

      <div>
        <Button
          size="sm"
          variant="primary"
          disabled={newlyChecked.length === 0}
          onClick={open}
        >
          {translate("dataTables.picker.open")}
        </Button>
      </div>
    </div>
  );
};
