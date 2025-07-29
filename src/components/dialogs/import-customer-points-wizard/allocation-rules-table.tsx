import React, { useCallback } from "react";
import {
  AllocationRule,
  defaultAllocationRule,
} from "src/hydraulic-model/customer-points";
import {
  PlusIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  SymbolIcon,
} from "@radix-ui/react-icons";
import { NumericField } from "src/components/form/numeric-field";
import { localizeDecimal } from "src/infra/i18n/numbers";

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
  const handleAddRule = useCallback(() => {
    const newRule: AllocationRule = { ...defaultAllocationRule };
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
          No allocation rules defined. Click "Add Rule" to create your first
          rule.
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                Order
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Max Diameter (mm)
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Max Distance (m)
              </th>
              {!isEditing && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                  Allocations
                </th>
              )}
              {isEditing && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  Actions
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
                  <NumericField
                    label="Max Diameter"
                    displayValue={localizeDecimal(rule.maxDiameter)}
                    onChangeValue={(value) =>
                      handleRuleChange(index, "maxDiameter", value)
                    }
                    positiveOnly={true}
                    readOnly={!isEditing}
                    styleOptions={{
                      padding: "sm",
                      border: isEditing ? "sm" : "none",
                    }}
                  />
                </td>
                <td className="px-4 py-3">
                  <NumericField
                    label="Max Distance"
                    displayValue={localizeDecimal(rule.maxDistance)}
                    onChangeValue={(value) =>
                      handleRuleChange(index, "maxDistance", value)
                    }
                    positiveOnly={true}
                    readOnly={!isEditing}
                    styleOptions={{
                      padding: "sm",
                      border: isEditing ? "sm" : "none",
                    }}
                  />
                </td>
                {!isEditing && (
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {isAllocating ? (
                      <div className="flex justify-center">
                        <SymbolIcon
                          className="animate-spin w-4 h-4 text-gray-500"
                          data-testid="allocation-loading"
                        />
                      </div>
                    ) : (
                      allocationCounts[index]
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
                        title="Move up"
                      >
                        <ChevronUpIcon className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveRule(index, "down")}
                        disabled={index === rules.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move down"
                      >
                        <ChevronDownIcon className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveRule(index)}
                        disabled={rules.length <= 1}
                        className="p-1 text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Remove rule"
                      >
                        <TrashIcon className="w-4 h-4" />
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
          <button
            type="button"
            onClick={handleAddRule}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-purple-700 bg-purple-100 border border-purple-300 rounded-md hover:bg-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Add Rule
          </button>
        </div>
      )}
    </>
  );
};
