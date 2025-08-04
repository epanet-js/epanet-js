import React, { useCallback, useState, useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { AllocationRule } from "src/hydraulic-model/customer-points";
import {
  CheckCircledIcon,
  ExclamationTriangleIcon,
} from "@radix-ui/react-icons";
import { AllocationRulesTable } from "./allocation-rules-table";
import { dataAtom } from "src/state/jotai";
import { allocateCustomerPoints } from "src/hydraulic-model/model-operations/allocate-customer-points";
import { initializeCustomerPoints } from "src/hydraulic-model/customer-points";
import { useWizardState } from "./use-wizard-state";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { useTranslate } from "src/hooks/use-translate";

export const AllocationStep: React.FC = () => {
  const [tempRules, setTempRules] = useState<AllocationRule[]>([]);
  const data = useAtomValue(dataAtom);
  const translate = useTranslate();

  const {
    parsedDataSummary,
    allocationRules,
    allocationResult,
    isAllocating,
    lastAllocatedRules,
    error,
    isProcessing,
    isEditingRules,
    setError,
    setIsAllocating,
    setAllocationResult,
    setLastAllocatedRules,
    setConnectionCounts,
    setAllocationRules,
    setIsEditingRules,
  } = useWizardState();

  const forceLoadingState = () =>
    new Promise((resolve) => setTimeout(resolve, 10));

  const performAllocation = useCallback(
    async (rules: AllocationRule[]) => {
      if (!parsedDataSummary?.validCustomerPoints?.length) {
        return;
      }

      const validCustomerPoints = parsedDataSummary.validCustomerPoints;

      setIsAllocating(true);
      setError(null);

      await forceLoadingState();

      try {
        const customerPoints = initializeCustomerPoints();
        validCustomerPoints.forEach((point) => {
          customerPoints.set(point.id, point);
        });

        const result = await allocateCustomerPoints(data.hydraulicModel, {
          allocationRules: rules,
          customerPoints,
        });

        setAllocationResult(result);
        setLastAllocatedRules([...rules]);

        const connectionCounts: { [ruleIndex: number]: number } = {};
        result.ruleMatches.forEach((count, index) => {
          connectionCounts[index] = count;
        });
        setConnectionCounts(connectionCounts);
      } catch (error) {
        setError(
          translate(
            "importCustomerPoints.wizard.allocationStep.allocationFailed",
            (error as Error).message,
          ),
        );
      } finally {
        setIsAllocating(false);
      }
    },
    [
      parsedDataSummary,
      data.hydraulicModel,
      setIsAllocating,
      setError,
      setAllocationResult,
      setLastAllocatedRules,
      setConnectionCounts,
      translate,
    ],
  );

  const shouldTriggerAllocation = useCallback(
    (rules: AllocationRule[]) => {
      if (!parsedDataSummary?.validCustomerPoints?.length) {
        return false;
      }

      if (isAllocating) {
        return false;
      }

      if (!lastAllocatedRules) {
        return true;
      }

      if (rules.length !== lastAllocatedRules.length) {
        return true;
      }

      return rules.some((rule, index) => {
        const lastRule = lastAllocatedRules[index];
        return (
          rule.maxDistance !== lastRule.maxDistance ||
          rule.maxDiameter !== lastRule.maxDiameter
        );
      });
    },
    [parsedDataSummary, isAllocating, lastAllocatedRules],
  );

  const handleEdit = useCallback(() => {
    setTempRules([...allocationRules]);
    setIsEditingRules(true);
  }, [allocationRules, setIsEditingRules]);

  const handleSave = useCallback(() => {
    setAllocationRules(tempRules);
    setIsEditingRules(false);
    setTempRules([]);

    if (shouldTriggerAllocation(tempRules)) {
      void performAllocation(tempRules);
    }
  }, [
    tempRules,
    setAllocationRules,
    setIsEditingRules,
    shouldTriggerAllocation,
    performAllocation,
  ]);

  const handleCancel = useCallback(() => {
    setTempRules([]);
    setIsEditingRules(false);
  }, [setIsEditingRules]);

  const handleRulesChange = useCallback((newRules: AllocationRule[]) => {
    setTempRules(newRules);
  }, []);

  const initialized = useRef<boolean>(false);
  useEffect(() => {
    if (initialized.current) return;

    initialized.current = true;
    void performAllocation(allocationRules);
  }, [performAllocation, allocationRules]);

  const displayRules = isEditingRules ? tempRules : allocationRules;
  const allocationCounts = allocationResult?.ruleMatches || [];
  const totalCustomerPoints =
    parsedDataSummary?.validCustomerPoints?.length || 0;
  const totalAllocated = allocationCounts.reduce(
    (total, count) => total + count,
    0,
  );
  const unallocatedCount = Math.max(0, totalCustomerPoints - totalAllocated);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">
          {translate("importCustomerPoints.wizard.allocationStep.title")}
        </h2>
        <p className="text-sm text-gray-600">
          {translate("importCustomerPoints.wizard.allocationStep.description")}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-md font-medium">
            {translate("importCustomerPoints.wizard.allocationStep.rulesTitle")}
          </h3>
          {!isEditingRules ? (
            <button
              type="button"
              onClick={handleEdit}
              disabled={isAllocating}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-100 border border-purple-300 rounded-md hover:bg-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-purple-100"
            >
              {translate(
                "importCustomerPoints.wizard.allocationStep.editButton",
              )}
            </button>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 border border-green-300 rounded-md hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
              >
                {translate(
                  "importCustomerPoints.wizard.allocationStep.saveButton",
                )}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
              >
                {translate(
                  "importCustomerPoints.wizard.allocationStep.cancelButton",
                )}
              </button>
            </div>
          )}
        </div>

        <AllocationRulesTable
          rules={displayRules}
          allocationCounts={allocationCounts}
          isEditing={isEditingRules}
          isAllocating={isAllocating}
          onChange={handleRulesChange}
        />

        <AllocationSummary
          totalAllocated={totalAllocated}
          unallocatedCount={unallocatedCount}
          isVisible={
            !isEditingRules && allocationRules.length > 0 && !isAllocating
          }
          totalCustomerPoints={totalCustomerPoints}
        />
      </div>

      {isAllocating && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
          <span className="ml-2 text-sm text-gray-600">
            {translate(
              "importCustomerPoints.wizard.allocationStep.computingMessage",
            )}
          </span>
        </div>
      )}

      {isProcessing && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
          <span className="ml-2 text-sm text-gray-600">
            {translate(
              "importCustomerPoints.wizard.allocationStep.processingMessage",
            )}
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
  const translate = useTranslate();

  if (!isVisible) {
    return null;
  }

  const allocatedPercentage =
    totalCustomerPoints > 0
      ? Math.round((totalAllocated / totalCustomerPoints) * 100)
      : 0;
  const unallocatedPercentage =
    totalCustomerPoints > 0
      ? Math.round((unallocatedCount / totalCustomerPoints) * 100)
      : 0;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <h4 className="text-sm font-medium text-gray-800 mb-2">
        {translate(
          "importCustomerPoints.wizard.allocationStep.summaryTitle",
          localizeDecimal(totalCustomerPoints),
        )}
      </h4>
      <div className="space-y-2">
        <div className="flex items-center">
          <CheckCircledIcon className="w-4 h-4 text-green-500 mr-2" />
          <span className="text-sm text-gray-700">
            {translate(
              "importCustomerPoints.wizard.allocationStep.allocatedPoints",
              localizeDecimal(totalAllocated),
              allocatedPercentage.toString(),
            )}
          </span>
        </div>
        {unallocatedCount > 0 && (
          <div className="flex items-center">
            <ExclamationTriangleIcon className="w-4 h-4 text-orange-500 mr-2" />
            <span className="text-sm text-orange-700">
              {translate(
                "importCustomerPoints.wizard.allocationStep.unallocatedPoints",
                localizeDecimal(unallocatedCount),
                unallocatedPercentage.toString(),
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
