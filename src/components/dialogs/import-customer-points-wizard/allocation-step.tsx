import React, { useCallback, useState } from "react";
import { WizardState, WizardActions, AllocationRule } from "./types";
import {
  CheckCircledIcon,
  ExclamationTriangleIcon,
} from "@radix-ui/react-icons";
import { AllocationRulesTable } from "./allocation-rules-table";

type AllocationStepProps = {
  state: WizardState;
  actions: WizardActions;
};

export const AllocationStep: React.FC<AllocationStepProps> = ({
  state,
  actions,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempRules, setTempRules] = useState<AllocationRule[]>([]);

  const handleEdit = useCallback(() => {
    setTempRules([...state.allocationRules]);
    setIsEditing(true);
  }, [state.allocationRules]);

  const handleSave = useCallback(() => {
    actions.setAllocationRules(tempRules);
    setIsEditing(false);
    setTempRules([]);
  }, [tempRules, actions]);

  const handleCancel = useCallback(() => {
    setTempRules([]);
    setIsEditing(false);
  }, []);

  const handleRulesChange = useCallback((newRules: AllocationRule[]) => {
    setTempRules(newRules);
  }, []);

  const calculateMockAllocationCounts = (rules: AllocationRule[]): number[] => {
    return rules.map((_rule) => Math.floor(Math.random() * 50) + 10);
  };

  const displayRules = isEditing ? tempRules : state.allocationRules;
  const allocationCounts = calculateMockAllocationCounts(displayRules);

  const totalCustomerPoints = 127; // Mock total
  const totalAllocated = allocationCounts.reduce(
    (total, count) => total + count,
    0,
  );
  const unallocatedCount = Math.max(0, totalCustomerPoints - totalAllocated);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">Customers Allocation</h2>
        <p className="text-sm text-gray-600">
          Define rules for connecting customer points to pipes. You can specify
          multiple max distance and max diameter pairs to control how customer
          points are allocated to the network.
        </p>
      </div>

      {state.error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-red-700 text-sm">{state.error}</p>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-md font-medium">Allocation Rules</h3>
          {!isEditing ? (
            <button
              type="button"
              onClick={handleEdit}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-100 border border-purple-300 rounded-md hover:bg-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors"
            >
              Edit
            </button>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 border border-green-300 rounded-md hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
              >
                Save
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <AllocationRulesTable
          rules={displayRules}
          allocationCounts={allocationCounts}
          isEditing={isEditing}
          onChange={handleRulesChange}
        />

        <AllocationSummary
          totalAllocated={totalAllocated}
          unallocatedCount={unallocatedCount}
          isVisible={!isEditing && state.allocationRules.length > 0}
        />
      </div>

      {state.isProcessing && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
          <span className="ml-2 text-sm text-gray-600">
            Processing allocation rules...
          </span>
        </div>
      )}
    </div>
  );
};

type AllocationSummaryProps = {
  totalAllocated: number;
  unallocatedCount: number;
  isVisible: boolean;
};

const AllocationSummary: React.FC<AllocationSummaryProps> = ({
  totalAllocated,
  unallocatedCount,
  isVisible,
}) => {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <h4 className="text-sm font-medium text-gray-800 mb-2">
        Allocation Summary
      </h4>
      <div className="space-y-2">
        <div className="flex items-center">
          <CheckCircledIcon className="w-4 h-4 text-green-500 mr-2" />
          <span className="text-sm text-gray-700">
            {totalAllocated} customer points will be allocated
          </span>
        </div>
        {unallocatedCount > 0 && (
          <div className="flex items-center">
            <ExclamationTriangleIcon className="w-4 h-4 text-orange-500 mr-2" />
            <span className="text-sm text-orange-700">
              {unallocatedCount} customer points remain unallocated
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
