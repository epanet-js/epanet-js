import React, { useCallback, useState } from "react";
import { useAtomValue } from "jotai";
import { WizardState, WizardActions, AllocationRule } from "./types";
import {
  CheckCircledIcon,
  ExclamationTriangleIcon,
} from "@radix-ui/react-icons";
import { AllocationRulesTable } from "./allocation-rules-table";
import { dataAtom } from "src/state/jotai";
import { allocateCustomerPoints } from "src/hydraulic-model/model-operations/allocate-customer-points";
import { initializeCustomerPoints } from "src/hydraulic-model/customer-points";

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
  const data = useAtomValue(dataAtom);

  const forceLoadingState = () =>
    new Promise((resolve) => setTimeout(resolve, 10));

  const performAllocation = useCallback(
    async (rules: AllocationRule[]) => {
      if (!state.parsedDataSummary?.validCustomerPoints?.length) {
        return;
      }

      const validCustomerPoints = state.parsedDataSummary.validCustomerPoints;

      actions.setIsAllocating(true);
      actions.setError(null);

      await forceLoadingState();

      try {
        const customerPoints = initializeCustomerPoints();
        validCustomerPoints.forEach((point) => {
          customerPoints.set(point.id, point);
        });

        const result = allocateCustomerPoints(data.hydraulicModel, {
          allocationRules: rules,
          customerPoints,
        });

        actions.setAllocationResult(result);
        actions.setLastAllocatedRules([...rules]);

        const connectionCounts: { [ruleIndex: number]: number } = {};
        result.ruleMatches.forEach((count, index) => {
          connectionCounts[index] = count;
        });
        actions.setConnectionCounts(connectionCounts);
      } catch (error) {
        actions.setError(`Allocation failed: ${(error as Error).message}`);
      } finally {
        actions.setIsAllocating(false);
      }
    },
    [state.parsedDataSummary, data.hydraulicModel, actions],
  );

  const shouldTriggerAllocation = useCallback(
    (rules: AllocationRule[]) => {
      if (!state.parsedDataSummary?.validCustomerPoints?.length) {
        return false;
      }

      if (state.isAllocating) {
        return false;
      }

      if (!state.lastAllocatedRules) {
        return true;
      }

      if (rules.length !== state.lastAllocatedRules.length) {
        return true;
      }

      return rules.some((rule, index) => {
        const lastRule = state.lastAllocatedRules![index];
        return (
          rule.maxDistance !== lastRule.maxDistance ||
          rule.maxDiameter !== lastRule.maxDiameter
        );
      });
    },
    [state.parsedDataSummary, state.isAllocating, state.lastAllocatedRules],
  );

  const handleEdit = useCallback(() => {
    setTempRules([...state.allocationRules]);
    setIsEditing(true);
  }, [state.allocationRules]);

  const handleSave = useCallback(() => {
    actions.setAllocationRules(tempRules);
    setIsEditing(false);
    setTempRules([]);

    if (shouldTriggerAllocation(tempRules)) {
      void performAllocation(tempRules);
    }
  }, [tempRules, actions, shouldTriggerAllocation, performAllocation]);

  const handleCancel = useCallback(() => {
    setTempRules([]);
    setIsEditing(false);
  }, []);

  const handleRulesChange = useCallback((newRules: AllocationRule[]) => {
    setTempRules(newRules);
  }, []);

  const displayRules = isEditing ? tempRules : state.allocationRules;
  const allocationCounts = state.allocationResult?.ruleMatches || [];
  const totalCustomerPoints =
    state.parsedDataSummary?.validCustomerPoints?.length || 0;
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
          isVisible={
            !isEditing &&
            state.allocationRules.length > 0 &&
            !state.isAllocating
          }
          totalCustomerPoints={totalCustomerPoints}
        />
      </div>

      {state.isAllocating && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
          <span className="ml-2 text-sm text-gray-600">
            Computing allocations...
          </span>
        </div>
      )}

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
  totalCustomerPoints: number;
};

const AllocationSummary: React.FC<AllocationSummaryProps> = ({
  totalAllocated,
  unallocatedCount,
  isVisible,
  totalCustomerPoints,
}) => {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <h4 className="text-sm font-medium text-gray-800 mb-2">
        Allocation Summary ({totalCustomerPoints} total customer points)
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
