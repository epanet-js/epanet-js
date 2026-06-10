import React, { useCallback, useState, useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import {
  CustomerPointAllocationRule,
  CustomerPoint,
  CustomerPointId,
  initializeCustomerPoints,
} from "@epanet-js/hydraulic-model";
import { Demand } from "@epanet-js/hydraulic-model";

import { AllocationRulesTable } from "./allocation-rules-table";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { modelFactoriesAtom } from "src/state/model-factories";

import { allocateCustomerPoints } from "src/lib/customer-points";
import { addCustomerPoints } from "src/hydraulic-model/mutations/add-customer-points";
import { WizardState, WizardActions } from "./types";
import { WizardActions as WizardActionsComponent } from "src/components/wizard";
import { Unit } from "@epanet-js/quantity";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import { notify } from "src/components/notifications";
import { useCustomerPointsImportReset } from "src/hooks/persistence/use-customer-points-import-reset";
import { Button } from "src/components/elements";
import { SuccessIcon, WarningIcon } from "src/icons";
export const AllocationStep: React.FC<{
  onBack: () => void;
  onFinish: () => void;
  renderActions?: boolean;
  wizardState: WizardState &
    WizardActions & {
      allocationRules: CustomerPointAllocationRule[];
      units: { diameter: Unit; length: Unit };
    };
}> = ({ onBack, onFinish, renderActions = true, wizardState }) => {
  const [tempRules, setTempRules] = useState<CustomerPointAllocationRule[]>([]);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { customerPointFactory, idGenerator } =
    useAtomValue(modelFactoriesAtom);
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const { customerPointsImportReset } = useCustomerPointsImportReset();
  const {
    parsedDataSummary,
    allocationRules,
    allocationResult,
    isAllocating,
    lastAllocatedRules,
    error,
    isProcessing,
    isEditingRules,
    keepDemands,
    setError,
    setIsAllocating,
    setAllocationResult,
    setLastAllocatedRules,
    setConnectionCounts,
    setAllocationRules,
    setIsEditingRules,
    setProcessing,
  } = wizardState;

  const forceLoadingState = () =>
    new Promise((resolve) => setTimeout(resolve, 10));

  const handleFinish = useCallback(async () => {
    if (!allocationResult) return;

    setProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 10));

    try {
      const previewPoints = [
        ...allocationResult.allocatedCustomerPoints.values(),
        ...allocationResult.disconnectedCustomerPoints.values(),
      ];

      const customerPointsToAdd: CustomerPoint[] = [];
      const reconciledDemands = new Map<CustomerPointId, Demand[]>();
      const previewDemands = parsedDataSummary?.customerPointDemands;

      for (const previewPoint of previewPoints) {
        const reconciled = customerPointFactory.load({
          id: idGenerator.newId(),
          coordinates: previewPoint.coordinates,
          label: previewPoint.label,
        });
        if (previewPoint.connection) {
          reconciled.connect(previewPoint.connection);
        }
        customerPointsToAdd.push(reconciled);
        const demands = previewDemands?.get(previewPoint.id);
        if (demands) {
          reconciledDemands.set(reconciled.id, demands);
        }
      }

      const updatedHydraulicModel = addCustomerPoints(
        hydraulicModel,
        customerPointsToAdd,
        {
          preserveJunctionDemands: keepDemands,
          overrideExisting: true,
          customerPointDemands: reconciledDemands,
        },
      );

      const importedCount = updatedHydraulicModel.customerPoints.size;

      void customerPointsImportReset({
        hydraulicModel: updatedHydraulicModel,
      });

      userTracking.capture({
        name: "importCustomerPoints.completed",
        count: importedCount,
        allocatedCount: allocationResult.allocatedCustomerPoints.size,
        disconnectedCount: allocationResult.disconnectedCustomerPoints.size,
        rulesCount: allocationRules.length,
      });

      notify({
        variant: "success",
        title: translate("importSuccessful"),
        Icon: SuccessIcon,
      });

      onFinish?.();
    } catch (error) {
      setError("Import failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  }, [
    allocationResult,
    hydraulicModel,
    parsedDataSummary?.customerPointDemands,
    keepDemands,
    onFinish,
    setProcessing,
    customerPointsImportReset,
    customerPointFactory,
    idGenerator,
    userTracking,
    setError,
    translate,
    allocationRules.length,
  ]);

  const performAllocation = useCallback(
    async (rules: CustomerPointAllocationRule[]) => {
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

        const result = await allocateCustomerPoints(hydraulicModel, {
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
      hydraulicModel,
      setIsAllocating,
      setError,
      setAllocationResult,
      setLastAllocatedRules,
      setConnectionCounts,
      translate,
    ],
  );

  const shouldTriggerAllocation = useCallback(
    (rules: CustomerPointAllocationRule[]) => {
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
    userTracking.capture({
      name: "importCustomerPoints.allocationRules.editStarted",
      rulesCount: allocationRules.length,
    });

    setTempRules([...allocationRules]);
    setIsEditingRules(true);
  }, [allocationRules, setIsEditingRules, userTracking]);

  const handleSave = useCallback(() => {
    userTracking.capture({
      name: "importCustomerPoints.allocationRules.saved",
      rulesCount: tempRules.length,
      allocatedCount: allocationResult?.allocatedCustomerPoints.size || 0,
      disconnectedCount: allocationResult?.disconnectedCustomerPoints.size || 0,
    });

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
    userTracking,
    allocationResult,
  ]);

  const handleCancel = useCallback(() => {
    userTracking.capture({
      name: "importCustomerPoints.allocationRules.editCanceled",
    });

    setTempRules([]);
    setIsEditingRules(false);
  }, [setIsEditingRules, userTracking]);

  const handleRulesChange = useCallback(
    (newRules: CustomerPointAllocationRule[]) => {
      setTempRules(newRules);
    },
    [],
  );

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

  const actionProps = {
    backAction: {
      onClick: onBack,
      disabled: isProcessing || isAllocating || isEditingRules,
    },
    finishAction:
      isEditingRules || isAllocating
        ? undefined
        : {
            onClick: handleFinish,
            disabled: isProcessing || !allocationResult,
            loading: isProcessing,
            label: isProcessing
              ? translate("wizard.processing")
              : translate(
                  "importCustomerPoints.wizard.allocationStep.applyChanges",
                ),
          },
  };

  return (
    <>
      <div className="overflow-y-auto grow space-y-4 scroll-shadows">
        <div>
          <h2 className="text-size-heading-3 font-semibold mb-2">
            {translate("importCustomerPoints.wizard.allocationStep.title")}
          </h2>
          <p className="text-size-base text-subtle">
            {translate(
              "importCustomerPoints.wizard.allocationStep.description",
            )}
          </p>
        </div>

        {error && (
          <div className="bg-error-subtle border border-red-200 rounded-md p-3">
            <p className="text-red-700 text-size-base">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-md font-medium">
              {translate(
                "importCustomerPoints.wizard.allocationStep.rulesTitle",
              )}
            </h3>
            {!isEditingRules ? (
              <Button
                type="button"
                onClick={handleEdit}
                disabled={isAllocating}
                variant="primary"
                size="sm"
              >
                {translate(
                  "importCustomerPoints.wizard.allocationStep.editButton",
                )}
              </Button>
            ) : (
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  onClick={handleSave}
                  variant="primary"
                  size="sm"
                >
                  {translate(
                    "importCustomerPoints.wizard.allocationStep.saveButton",
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={handleCancel}
                  variant="default"
                  size="sm"
                >
                  {translate(
                    "importCustomerPoints.wizard.allocationStep.cancelButton",
                  )}
                </Button>
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
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
            <span className="ml-2 text-size-base text-subtle">
              {translate(
                "importCustomerPoints.wizard.allocationStep.computingMessage",
              )}
            </span>
          </div>
        )}
      </div>

      {renderActions && <WizardActionsComponent {...actionProps} />}
    </>
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
      ? Math.round((totalAllocated / totalCustomerPoints) * 10000) / 100
      : 0;
  const unallocatedPercentage =
    totalCustomerPoints > 0
      ? Math.round((unallocatedCount / totalCustomerPoints) * 10000) / 100
      : 0;

  return (
    <div className="bg-panel border rounded-lg p-4">
      <h4 className="text-size-base font-medium text-default mb-2">
        {translate(
          "importCustomerPoints.wizard.allocationStep.summaryTitle",
          localizeDecimal(totalCustomerPoints),
        )}
      </h4>
      <div className="space-y-2">
        <div className="flex items-center">
          <SuccessIcon className="text-success mr-2" />
          <span className="text-size-base text-default">
            {translate(
              "importCustomerPoints.wizard.allocationStep.allocatedPoints",
              localizeDecimal(totalAllocated),
              allocatedPercentage.toString(),
            )}
          </span>
        </div>
        {unallocatedCount > 0 && (
          <div className="flex items-center">
            <WarningIcon className="text-warning mr-2" />
            <span className="text-size-base text-orange-700">
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
