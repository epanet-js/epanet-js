import { useAllocateCustomerPointsState } from "./wizard-state";

import { useTranslate } from "@epanet-js/i18n";
import { useCallback } from "react";
import { applyCustomerPointAllocation } from "src/hydraulic-model/model-operations";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { useAtomValue } from "jotai";
import { useUserTracking } from "src/infra/user-tracking";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { AllocationDialog } from "./allocation-dialog";

type AllocateCustomerPointsDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const AllocateCustomerPointsDialog: React.FC<
  AllocateCustomerPointsDialogProps
> = ({ isOpen, onClose }) => {
  const state = useAllocateCustomerPointsState();
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { transact } = useModelTransaction();

  const {
    allocationResult,
    setIsProcessing,
    allocationRules,
    setError,
    isProcessing,
    isAllocating,
    isEditingRules,
    customerAllocationMode,
    pipeAllocationMode,
    allocationZone,
  } = state;

  const handleFinish = useCallback(() => {
    if (!allocationResult) return;

    setIsProcessing(true);

    try {
      const moment = applyCustomerPointAllocation(hydraulicModel, {
        allocationResult,
      });
      transact(moment);

      userTracking.capture({
        name: "allocateCustomerPoints.completed",
        count:
          allocationResult.allocatedCustomerPoints.size +
          allocationResult.disconnectedCustomerPoints.size,
        allocatedCount: allocationResult.allocatedCustomerPoints.size,
        disconnectedCount: allocationResult.disconnectedCustomerPoints.size,
        rulesCount: allocationRules.length,
        pipeMode: pipeAllocationMode,
        customerMode: customerAllocationMode,
        hasZone: allocationZone !== null,
      });

      onClose();
    } catch {
      setError("Allocation failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }, [
    allocationResult,
    setIsProcessing,
    hydraulicModel,
    transact,
    userTracking,
    allocationRules.length,
    onClose,
    setError,
    pipeAllocationMode,
    customerAllocationMode,
    allocationZone,
  ]);

  const bottomButtonsDisabled =
    isProcessing || !allocationResult || isAllocating || isEditingRules;

  const footer = (
    <SimpleDialogActions
      action={
        isProcessing
          ? translate("wizard.processing")
          : translate("allocateCustomerPoints.dialog.applyChanges")
      }
      onAction={handleFinish}
      onClose={onClose}
      isDisabled={bottomButtonsDisabled}
      isSubmitting={isProcessing}
    />
  );

  return (
    <BaseDialog
      title={translate("allocateCustomerPoints.dialog.title")}
      size="lg"
      isOpen={isOpen}
      onClose={onClose}
      footer={footer}
      preventClose={isProcessing}
    >
      <AllocationDialog state={state} />
    </BaseDialog>
  );
};
