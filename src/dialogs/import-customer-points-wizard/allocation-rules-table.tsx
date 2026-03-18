import React, { useCallback } from "react";
import {
  AllocationRule,
  defaultAllocationRules,
} from "src/hydraulic-model/customer-points";

import { NumericField } from "src/components/form/numeric-field";
import { TextField } from "src/components/panels/asset-panel/ui-components";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { useTranslate } from "src/hooks/use-translate";
import { useWizardState } from "./use-wizard-state";
import { Button } from "src/components/elements";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  AddIcon,
  DeleteIcon,
  RefreshIcon,
} from "src/icons";

type AllocationRulesTableProps = {
  rules: AllocationRule[];
  allocationCounts: number[];
  isEditing: boolean;
  isAllocating?: boolean;
  onChange: (newRules: AllocationRule[]) => void;
};

export const AllocationRulesTable: React.FC<AllocationRulesTableProps> = ({
  rules,
  allocationCounts,
  isEditing,
  isAllocating = false,
  onChange,
}) => {
  const { units } = useWizardState();
  const translateUnit = useTranslateUnit();
  const translate = useTranslate();
  const handleAddRule = useCallback(() => {
    const newRule: AllocationRule = { ...defaultAllocationRules[0] };
    onChange([...rules, newRule]);
  }, [rules, onChange]);

  const handleRemoveRule = useCallback(
    (index: number) => {
      onChange(rules.filter((_, i) => i !== index));
    },
    [rules, onChange],
  );

  const handleRuleChange = useCallback(
    (index: number, field: keyof AllocationRule, value: number) => {
      const updatedRules = rules.map((rule, i) =>
        i === index ? { ...rule, [field]: value } : rule,
      );
      onChange(updatedRules);
    },
    [rules, onChange],
  );

  const handleMoveRule = useCallback(
    (index: number, direction: "up" | "down") => {
      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= rules.length) return;

      const updatedRules = [...rules];
      [updatedRules[index], updatedRules[newIndex]] = [
        updatedRules[newIndex],
        updatedRules[index],
      ];
      onChange(updatedRules);
    },
    [rules, onChange],
  );

  if (rules.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <p className="text-gray-500 text-sm">
          {translate(
            "importCustomerPoints.wizard.allocationStep.table.noRulesMessage",
          )}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider w-16">
                {translate(
                  "importCustomerPoints.wizard.allocationStep.table.orderHeader",
                )}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                {translate(
                  "importCustomerPoints.wizard.allocationStep.table.maxDiameterLabel",
                )}{" "}
                ({translateUnit(units.diameter)})
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                {translate(
                  "importCustomerPoints.wizard.allocationStep.table.maxDistanceLabel",
                )}{" "}
                ({translateUnit(units.length)})
              </th>
              {!isEditing && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider w-32">
                  {translate(
                    "importCustomerPoints.wizard.allocationStep.table.allocationsHeader",
                  )}
                </th>
              )}
              {isEditing && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider w-24">
                  {translate(
                    "importCustomerPoints.wizard.allocationStep.table.actionsHeader",
                  )}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rules.map((rule, index) => (
              <tr
                key={index}
                className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
              >
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {index + 1}
                </td>
                <td className="px-4 py-3">
                  {isEditing ? (
                    <NumericField
                      label={translate(
                        "importCustomerPoints.wizard.allocationStep.table.maxDiameterLabel",
                      )}
                      displayValue={localizeDecimal(rule.maxDiameter)}
                      onChangeValue={(value) =>
                        handleRuleChange(index, "maxDiameter", value)
                      }
                      positiveOnly={true}
                      styleOptions={{
                        padding: "sm",
                        border: "sm",
                      }}
                    />
                  ) : (
                    <TextField padding="sm">
                      {localizeDecimal(rule.maxDiameter)}
                    </TextField>
                  )}
                </td>
                <td className="px-4 py-3">
                  {isEditing ? (
                    <NumericField
                      label={translate(
                        "importCustomerPoints.wizard.allocationStep.table.maxDistanceLabel",
                      )}
                      displayValue={localizeDecimal(rule.maxDistance)}
                      onChangeValue={(value) =>
                        handleRuleChange(index, "maxDistance", value)
                      }
                      positiveOnly={true}
                      styleOptions={{
                        padding: "sm",
                        border: "sm",
                      }}
                    />
                  ) : (
                    <TextField padding="sm">
                      {localizeDecimal(rule.maxDistance)}
                    </TextField>
                  )}
                </td>
                {!isEditing && (
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {isAllocating ? (
                      <div className="flex justify-center">
                        <RefreshIcon
                          className="animate-spin text-gray-500"
                          data-testid="allocation-loading"
                        />
                      </div>
                    ) : (
                      localizeDecimal(allocationCounts[index])
                    )}
                  </td>
                )}
                {isEditing && (
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => handleMoveRule(index, "up")}
                        disabled={index === 0}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        title={translate(
                          "importCustomerPoints.wizard.allocationStep.table.moveUpTooltip",
                        )}
                      >
                        <ChevronUpIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveRule(index, "down")}
                        disabled={index === rules.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        title={translate(
                          "importCustomerPoints.wizard.allocationStep.table.moveDownTooltip",
                        )}
                      >
                        <ChevronDownIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveRule(index)}
                        disabled={rules.length <= 1}
                        className="p-1 text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        title={translate(
                          "importCustomerPoints.wizard.allocationStep.table.removeRuleTooltip",
                        )}
                      >
                        <DeleteIcon />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isEditing && (
        <div className="flex justify-center">
          <Button
            type="button"
            onClick={handleAddRule}
            variant="default"
            size="sm"
          >
            <AddIcon />
            {translate(
              "importCustomerPoints.wizard.allocationStep.table.addRuleButton",
            )}
          </Button>
        </div>
      )}
    </>
  );
};
