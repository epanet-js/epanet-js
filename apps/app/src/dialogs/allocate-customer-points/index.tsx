import React, { useCallback, useState, useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import {
  AllocationRule,
  CustomerPoint,
  CustomerPointId,
  getDefaultAllocationRules,
  initializeCustomerPoints,
} from "@epanet-js/hydraulic-model";
import { Demand } from "@epanet-js/hydraulic-model";

import { AllocationRulesTable } from "./allocation-rules-table";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { modelFactoriesAtom } from "src/state/model-factories";

import { allocateCustomerPoints } from "src/hydraulic-model/model-operations/allocate-customer-points";
import type { AllocationResult } from "src/hydraulic-model/model-operations/allocate-customer-points";
import { addCustomerPoints } from "src/hydraulic-model/mutations/add-customer-points";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { useTranslate } from "src/hooks/use-translate";
import { notify } from "src/components/notifications";
import { useCustomerPointsImportReset } from "src/hooks/persistence/use-customer-points-import-reset";
import { Button } from "src/components/elements";
import { SuccessIcon, WarningIcon } from "src/icons";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { projectSettingsAtom } from "src/state/project-settings";

type AllocateCustomerPointsDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const AllocateCustomerPointsDialog: React.FC<
  AllocateCustomerPointsDialogProps
> = ({ isOpen, onClose }) => {
  const translate = useTranslate();
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { customerPointFactory, idGenerator } =
    useAtomValue(modelFactoriesAtom);
  const { units } = useAtomValue(projectSettingsAtom);
  const { customerPointsImportReset } = useCustomerPointsImportReset();

  const [allocationRules, setAllocationRules] = useState<AllocationRule[]>(() =>
    getDefaultAllocationRules(units),
  );
  const [tempRules, setTempRules] = useState<AllocationRule[]>([]);
  const [allocationResult, setAllocationResult] =
    useState<AllocationResult | null>(null);
  const [isAllocating, setIsAllocating] = useState(false);
  const [lastAllocatedRules, setLastAllocatedRules] = useState<
    AllocationRule[] | null
  >(null);
  const [, setConnectionCounts] = useState<{
    [ruleIndex: number]: number;
  } | null>(null);
  const [isEditingRules, setIsEditingRules] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disconnectedCustomerPoints = Array.from(
    hydraulicModel.customerPoints.values(),
  ).filter((cp) => !cp.connection);

  const forceLoadingState = () =>
    new Promise((resolve) => setTimeout(resolve, 10));

  const handleFinish = useCallback(async () => {
    if (!allocationResult) return;

    setIsProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 10));

    try {
      const previewPoints = [
        ...allocationResult.allocatedCustomerPoints.values(),
        ...allocationResult.disconnectedCustomerPoints.values(),
      ];

      const customerPointsToAdd: CustomerPoint[] = [];
      const reconciledDemands = new Map<CustomerPointId, Demand[]>();

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
      }

      const updatedHydraulicModel = addCustomerPoints(
        hydraulicModel,
        customerPointsToAdd,
        {
          preserveJunctionDemands: true,
          overrideExisting: true,
          customerPointDemands: reconciledDemands,
        },
      );

      void customerPointsImportReset({
        hydraulicModel: updatedHydraulicModel,
      });

      notify({
        variant: "success",
        title: translate("importSuccessful"),
        Icon: SuccessIcon,
      });

      onClose();
    } catch {
      setError("Import failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }, [
    allocationResult,
    hydraulicModel,
    onClose,
    customerPointsImportReset,
    customerPointFactory,
    idGenerator,
    translate,
  ]);

  const performAllocation = useCallback(
    async (rules: AllocationRule[]) => {
      if (!disconnectedCustomerPoints.length) {
        return;
      }

      setIsAllocating(true);
      setError(null);

      await forceLoadingState();

      try {
        const customerPoints = initializeCustomerPoints();
        disconnectedCustomerPoints.forEach((point) => {
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
      } catch (err) {
        setError(
          translate(
            "importCustomerPoints.wizard.allocationStep.allocationFailed",
            (err as Error).message,
          ),
        );
      } finally {
        setIsAllocating(false);
      }
    },
    [disconnectedCustomerPoints, hydraulicModel, translate],
  );

  const shouldTriggerAllocation = useCallback(
    (rules: AllocationRule[]) => {
      if (!disconnectedCustomerPoints.length) {
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
    [disconnectedCustomerPoints, isAllocating, lastAllocatedRules],
  );

  const handleEdit = useCallback(() => {
    setTempRules([...allocationRules]);
    setIsEditingRules(true);
  }, [allocationRules]);

  const handleSave = useCallback(() => {
    setAllocationRules(tempRules);
    setIsEditingRules(false);
    setTempRules([]);

    if (shouldTriggerAllocation(tempRules)) {
      void performAllocation(tempRules);
    }
  }, [tempRules, shouldTriggerAllocation, performAllocation]);

  const handleCancel = useCallback(() => {
    setTempRules([]);
    setIsEditingRules(false);
  }, []);

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
  const totalCustomerPoints = disconnectedCustomerPoints.length;
  const totalAllocated = allocationCounts.reduce(
    (total, count) => total + count,
    0,
  );
  const unallocatedCount = Math.max(0, totalCustomerPoints - totalAllocated);

  const footer = (
    <SimpleDialogActions
      action={
        isProcessing
          ? translate("wizard.processing")
          : translate("importCustomerPoints.wizard.allocationStep.applyChanges")
      }
      onAction={handleFinish}
      onClose={onClose}
      isDisabled={
        isProcessing || !allocationResult || isEditingRules || isAllocating
      }
      isSubmitting={isProcessing}
    />
  );

  return (
    <BaseDialog
      title={translate("importCustomerPoints.wizard.allocationStep.title")}
      size="lg"
      isOpen={isOpen}
      onClose={onClose}
      footer={footer}
      preventClose={isProcessing}
    >
      <div className="p-4 overflow-y-auto grow space-y-4">
        <div>
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
    </BaseDialog>
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
