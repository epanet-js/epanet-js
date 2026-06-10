import React, { useCallback } from "react";
import { AllocationRule } from "@epanet-js/hydraulic-model";
import { useAtomValue } from "jotai";

import { NumericField } from "src/components/form/numeric-field";
import { TextField } from "src/components/form/text-field";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { useTranslate } from "src/hooks/use-translate";
import { projectSettingsAtom } from "src/state/project-settings";
import { RefreshIcon } from "src/icons";

type AllocationRulesTableProps = {
  rules: AllocationRule[];
  allocationCounts: number[];
  isAllocating?: boolean;
  onDistanceChange: (index: number, value: number) => void;
};

export const AllocationRulesTable: React.FC<AllocationRulesTableProps> = ({
  rules,
  allocationCounts,
  isAllocating = false,
  onDistanceChange,
}) => {
  const { units } = useAtomValue(projectSettingsAtom);
  const translateUnit = useTranslateUnit();
  const translate = useTranslate();

  const handleDistanceChange = useCallback(
    (index: number) => (value: number) => {
      onDistanceChange(index, value);
    },
    [onDistanceChange],
  );

  if (rules.length === 0) {
    return null;
  }

  return (
    <div className="bg-base border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-panel border-b">
          <tr>
            <th className="px-4 py-3 text-left text-size-small font-medium text-subtle tracking-wider">
              {translate(
                "importCustomerPoints.wizard.allocationStep.table.maxDiameterLabel",
              )}{" "}
              ({translateUnit(units.diameter)})
            </th>
            <th className="px-4 py-3 text-left text-size-small font-medium text-subtle tracking-wider">
              {translate(
                "importCustomerPoints.wizard.allocationStep.table.maxDistanceLabel",
              )}{" "}
              ({translateUnit(units.length)})
            </th>
            <th className="px-4 py-3 text-left text-size-small font-medium text-subtle tracking-wider w-32">
              {translate(
                "importCustomerPoints.wizard.allocationStep.table.allocationsHeader",
              )}
            </th>
          </tr>
        </thead>
        <tbody className="bg-base divide-y divide-gray-200">
          {rules.map((rule, index) => (
            <tr
              key={rule.maxDiameter}
              className={index % 2 === 0 ? "bg-base" : "bg-panel"}
            >
              <td className="px-4 py-3">
                <TextField padding="sm">
                  {localizeDecimal(rule.maxDiameter)}
                </TextField>
              </td>
              <td className="px-4 py-3">
                <NumericField
                  label={translate(
                    "importCustomerPoints.wizard.allocationStep.table.maxDistanceLabel",
                  )}
                  displayValue={localizeDecimal(rule.maxDistance)}
                  onChangeValue={handleDistanceChange(index)}
                  positiveOnly={true}
                  styleOptions={{
                    padding: "sm",
                    border: "sm",
                  }}
                />
              </td>
              <td className="px-4 py-3 text-size-base text-subtle">
                {isAllocating ? (
                  <div className="flex justify-center">
                    <RefreshIcon
                      className="animate-spin text-subtle"
                      data-testid="allocation-loading"
                    />
                  </div>
                ) : (
                  localizeDecimal(allocationCounts[index])
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
