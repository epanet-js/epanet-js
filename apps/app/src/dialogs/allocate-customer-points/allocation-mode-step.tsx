import { useMemo, useState } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { AllocateCustomerPointsState } from "./wizard-state";
import { useAtomValue } from "jotai";
import { zonesAtom } from "src/state/zones";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection";
import { Selector, SelectorListOption } from "@epanet-js/ui-kit";
import { ZoneId } from "src/lib/zones";

export const AllocationModeStep = ({
  state,
}: {
  state: AllocateCustomerPointsState;
}) => {
  const {
    setPipeAllocationMode,
    setCustomerAllocationMode,
    customerAllocationMode,
    allocationZone,
    setAllocationZone,
  } = state;
  const translate = useTranslate();
  const zones = useAtomValue(zonesAtom);
  const selection = useAtomValue(selectionAtom);
  const { assets } = useAtomValue(stagingModelDerivedAtom);
  const hasSelectedPipes = useMemo(
    () =>
      USelection.getAssetIds(selection).some(
        (id) => assets.get(id)?.type === "pipe",
      ),
    [selection, assets],
  );

  const zoneOptions = useMemo<SelectorListOption<ZoneId>[]>(
    () =>
      Object.values(zones).map((zone) => ({
        label: zone.label,
        value: zone.id,
      })),
    [zones],
  );

  const pipeSelectionOptions = [
    {
      id: "allPipes",
      title: translate(
        `allocateCustomerPoints.allocationOptions.pipeSelection.allPipes`,
      ),
      description: translate(
        `allocateCustomerPoints.allocationOptions.pipeSelection.allPipesDescription`,
      ),
      disabled: false,
    },
    {
      id: "selectedPipes",
      title: translate(
        `allocateCustomerPoints.allocationOptions.pipeSelection.selectedPipes`,
      ),
      description: translate(
        `allocateCustomerPoints.allocationOptions.pipeSelection.selectedPipesDescription`,
      ),
      disabled: !hasSelectedPipes,
    },
  ];

  const hasZones = Object.keys(zones).length > 0;
  const customerSelectionOptions = [
    {
      id: "allCustomers",
      title: translate(
        `allocateCustomerPoints.allocationOptions.customerSelection.allCustomers`,
      ),
      description: translate(
        `allocateCustomerPoints.allocationOptions.customerSelection.allCustomersDescription`,
      ),
      disabled: false,
    },
    {
      id: "zoneCustomers",
      title: translate(
        `allocateCustomerPoints.allocationOptions.customerSelection.zoneCustomers`,
      ),
      description: translate(
        `allocateCustomerPoints.allocationOptions.customerSelection.zoneCustomersDescription`,
      ),
      disabled: !hasZones,
    },
  ];

  return (
    <div className="overflow-y-auto grow space-y-4">
      <span className="text-subtle text-size-base">
        {translate(`allocateCustomerPoints.allocationOptions.description`)}
      </span>
      <MultiSelector
        title={translate(
          `allocateCustomerPoints.allocationOptions.pipeSelection.title`,
        )}
        options={pipeSelectionOptions}
        defaultValue="allPipes"
        onChange={(id) =>
          id === "allPipes"
            ? setPipeAllocationMode("allPipes")
            : setPipeAllocationMode("selectedPipes")
        }
      />

      <MultiSelector
        title={translate(
          `allocateCustomerPoints.allocationOptions.customerSelection.title`,
        )}
        options={customerSelectionOptions}
        defaultValue="allCustomers"
        onChange={(id) => {
          if (id === "allCustomers") {
            setCustomerAllocationMode("allCustomers");
            setAllocationZone(null);
          } else {
            setCustomerAllocationMode("zoneCustomers");
          }
        }}
      />

      {customerAllocationMode === "zoneCustomers" && (
        <Selector
          options={zoneOptions}
          selected={allocationZone}
          nullable
          placeholder={translate(
            `allocateCustomerPoints.allocationOptions.customerSelection.selectZone`,
          )}
          onChange={(zoneId) => setAllocationZone(zoneId)}
          styleOptions={{ border: true }}
        />
      )}
    </div>
  );
};

const MultiSelector = ({
  title,
  onChange,
  defaultValue,
  options,
}: {
  title: string;
  defaultValue: string;
  options: {
    id: string;
    title: string;
    description: string;
    disabled: boolean;
  }[];
  onChange: (id: string) => void;
}) => {
  const [selectedOption, setSelectedOption] = useState<string>(defaultValue);

  return (
    <>
      <h2 className="text-size-heading-3 font-semibold">{title}</h2>

      <div className="space-y-4">
        <div className="space-y-3">
          {options.map((op) => (
            <label
              key={op.id}
              className={`flex items-start space-x-3 rounded-md p-3 border-2 transition-colors ${
                op.disabled
                  ? "opacity-50 cursor-not-allowed bg-base"
                  : selectedOption === op.id
                    ? "cursor-pointer border-accent bg-accent-tint"
                    : "cursor-pointer bg-base hover:border-strong hover:bg-panel"
              }`}
            >
              <input
                type="radio"
                name={title}
                disabled={op.disabled}
                checked={selectedOption === op.id}
                onChange={() => {
                  setSelectedOption(op.id);
                  onChange(op.id);
                }}
                className="mt-1 h-4 w-4 text-accent-hover border-strong focus:ring-accent"
              />
              <div className="flex-1">
                <div className="font-medium text-default">{op.title}</div>
                <div className="text-size-base text-subtle mt-1">
                  {op.description}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </>
  );
};
