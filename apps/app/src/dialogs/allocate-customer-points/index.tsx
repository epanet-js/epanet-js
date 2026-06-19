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

  const isSingleDialogEnabled = useFeatureFlag(
    "FLAG_CP_ALLOCATION_SINGLE_DIALOG",
  );

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

  if (isSingleDialogEnabled) {
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
              onClick: () => {
                userTracking.capture({
                  name: "allocateCustomerPoints.nextClicked",
                  pipeMode: pipeAllocationMode,
                  customerMode: customerAllocationMode,
                  hasZone: allocationZone !== null,
                });
                setStep(2);
              },
              disabled:
                customerAllocationMode === "zoneCustomers" &&
                allocationZone === null,
            }}
          />
        );
      case 2:
        return (
          <WizardActions
            backAction={{
              onClick: () => {
                userTracking.capture({
                  name: "allocateCustomerPoints.back",
                });
                setStep(1);
              },
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
