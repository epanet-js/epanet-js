import React from "react";
import {
  AllocationRule,
  getDefaultAllocationRules,
} from "@epanet-js/hydraulic-model";
import { useAtomValue } from "jotai";

import { AllocationRulesTable } from "./allocation-rules-table";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { useTranslate } from "src/hooks/use-translate";
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
  const { units } = useAtomValue(projectSettingsAtom);

  const allocationRules: AllocationRule[] = getDefaultAllocationRules(units);
  const isEditingRules = false;
  const isAllocating = false;
  const isProcessing = false;
  const error: string | null = null;
  const allocationResult = null;
  const displayRules = allocationRules;
  const allocationCounts: number[] = [];
  const totalCustomerPoints = 0;
  const totalAllocated = 0;
  const unallocatedCount = 0;

  const handleFinish = () => {};
  const handleEdit = () => {};
  const handleSave = () => {};
  const handleCancel = () => {};
  const handleRulesChange = (_newRules: AllocationRule[]) => {};

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
      <div className="p-4 overflow-y-auto grow space-y-4 scroll-shadows">
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
