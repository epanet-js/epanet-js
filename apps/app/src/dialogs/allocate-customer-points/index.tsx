import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { AllocationStep } from "./allocation-step";
import { useAllocateCustomerPointsState } from "./wizard-state";
import {
  Step,
  WizardActions,
  WizardContainer,
  WizardContent,
  WizardHeader,
} from "src/components/wizard";
import { useTranslate } from "@epanet-js/i18n";
import { useCallback } from "react";
import { applyCustomerPointAllocation } from "src/hydraulic-model/model-operations";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { useAtomValue } from "jotai";
import { useUserTracking } from "src/infra/user-tracking";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { AllocationModeStep } from "./allocation-mode-step";

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

  const isPerZoneAllocationEnabled = useFeatureFlag("FLAG_ZONE_CP_ALLOCATION");

  const {
    step,
    setStep,
    allocationResult,
    setIsProcessing,
    allocationRules,
    setError,
    isProcessing,
    isAllocating,
    isEditingRules,
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
        name: "importCustomerPoints.completed",
        count:
          allocationResult.allocatedCustomerPoints.size +
          allocationResult.disconnectedCustomerPoints.size,
        allocatedCount: allocationResult.allocatedCustomerPoints.size,
        disconnectedCount: allocationResult.disconnectedCustomerPoints.size,
        rulesCount: allocationRules.length,
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
  ]);

  const bottomButtonsDisabled =
    isProcessing || !allocationResult || isAllocating || isEditingRules;

  if (!isPerZoneAllocationEnabled) {
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
        <AllocationStep state={state} />
      </BaseDialog>
    );
  }

  const steps: Step[] = [
    {
      number: 1,
      label: translate("allocateCustomerPoints.wizard.allocationModeStep"),
      ariaLabel: "Step 1: Allocation mode",
    },
    {
      number: 2,
      label: translate("allocateCustomerPoints.wizard.allocationStep"),
      ariaLabel: "Step 2: Customer allocation",
    },
  ];

  const footer = (() => {
    switch (step) {
      case 1:
        return (
          <WizardActions
            nextAction={{
              onClick: () => setStep(2),
              disabled: false,
            }}
          />
        );
      case 2:
        return (
          <WizardActions
            backAction={{
              onClick: () => setStep(1),
              disabled: bottomButtonsDisabled,
            }}
            finishAction={{
              onClick: handleFinish,
              disabled: bottomButtonsDisabled,
            }}
          />
        );
    }
  })();

  return (
    <WizardContainer footer={footer}>
      <WizardHeader
        title={translate("allocateCustomerPoints.wizard.title")}
        steps={steps}
        currentStep={step}
        onClose={onClose}
      />
      <WizardContent>
        {step === 1 && <AllocationModeStep state={state} />}
        {step === 2 && <AllocationStep state={state} />}
      </WizardContent>
    </WizardContainer>
  );
};
