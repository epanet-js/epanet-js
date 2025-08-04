import React, { useCallback } from "react";
import { useAtomValue } from "jotai";
import {
  WizardContainer,
  WizardHeader,
  WizardContent,
  WizardActions,
  type Step,
} from "src/components/wizard";
import { useWizardState } from "./use-wizard-state";
import { DataInputStep } from "./data-input-step";
import { DataPreviewStep } from "./data-preview-step";
import { DemandOptionsStep } from "./demand-options-step";
import { AllocationStep } from "./allocation-step";
import { useTranslate } from "src/hooks/use-translate";
import { dataAtom } from "src/state/jotai";
import { connectCustomerPoints } from "src/hydraulic-model/mutations/connect-customer-points";
import { useUserTracking } from "src/infra/user-tracking";
import { notify } from "src/components/notifications";
import { CheckIcon } from "@radix-ui/react-icons";
import { usePersistence } from "src/lib/persistence/context";

type ImportCustomerPointsWizardProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const ImportCustomerPointsWizard: React.FC<
  ImportCustomerPointsWizardProps
> = ({ onClose }) => {
  const data = useAtomValue(dataAtom);
  const userTracking = useUserTracking();
  const wizardState = useWizardState();
  const translate = useTranslate();
  const rep = usePersistence();
  const transactImport = rep.useTransactImport();

  const handleClose = useCallback(() => {
    wizardState.reset();
    onClose();
  }, [wizardState, onClose]);

  const handleCancel = useCallback(() => {
    userTracking.capture({
      name: "importCustomerPoints.canceled",
    });
    handleClose();
  }, [userTracking, handleClose]);

  const handleFinishImport = useCallback(async () => {
    const allocatedCustomerPoints =
      wizardState.allocationResult!.allocatedCustomerPoints;

    wizardState.setProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const updatedHydraulicModel = connectCustomerPoints(
      data.hydraulicModel,
      allocatedCustomerPoints,
      { preserveJunctionDemands: wizardState.keepDemands },
    );

    const importedCount = updatedHydraulicModel.customerPoints.size;

    transactImport(updatedHydraulicModel, data.modelMetadata, "customerpoints");

    userTracking.capture({
      name: "importCustomerPoints.completed",
      count: importedCount,
    });

    notify({
      variant: "success",
      title: "Import Successful",
      description: `Successfully imported ${importedCount} customer points`,
      Icon: CheckIcon,
    });

    handleClose();
  }, [wizardState, data, userTracking, handleClose, transactImport]);

  const maxStep = 4;
  const canGoNext =
    (wizardState.currentStep === 1 && wizardState.parsedDataSummary !== null) ||
    (wizardState.currentStep === 2 && wizardState.parsedDataSummary !== null) ||
    wizardState.currentStep === 3;
  const canGoBack =
    wizardState.currentStep === 2 ||
    wizardState.currentStep === 3 ||
    wizardState.currentStep === 4;
  const isNextDisabled =
    wizardState.isLoading ||
    wizardState.isProcessing ||
    wizardState.isAllocating ||
    wizardState.isEditingRules;
  const isFinishDisabled =
    wizardState.isProcessing ||
    wizardState.isAllocating ||
    wizardState.isEditingRules ||
    !wizardState.parsedDataSummary?.validCustomerPoints?.length;

  const handleModalDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleModalDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const steps: Step[] = [
    {
      number: 1,
      label: translate("importCustomerPoints.wizard.dataInputStep"),
      ariaLabel: "Step 1: Data Input",
    },
    {
      number: 2,
      label: translate("importCustomerPoints.wizard.dataPreviewStep"),
      ariaLabel: "Step 2: Data Preview",
    },
    {
      number: 3,
      label: translate("importCustomerPoints.wizard.demandOptionsStep"),
      ariaLabel: "Step 3: Demand Options",
    },
    {
      number: 4,
      label: "Customers Allocation",
      ariaLabel: "Step 4: Customers Allocation",
    },
  ];

  return (
    <WizardContainer onDragOver={handleModalDragOver} onDrop={handleModalDrop}>
      <WizardHeader
        title={translate("importCustomerPoints.wizard.title")}
        steps={steps}
        currentStep={wizardState.currentStep}
      />

      <WizardContent>
        {wizardState.currentStep === 1 && <DataInputStep />}
        {wizardState.currentStep === 2 && <DataPreviewStep />}
        {wizardState.currentStep === 3 && (
          <DemandOptionsStep onFinish={() => Promise.resolve()} />
        )}
        {wizardState.currentStep === 4 && <AllocationStep />}
      </WizardContent>

      <WizardActions
        cancelAction={{
          label: translate("importCustomerPoints.wizard.buttons.cancel"),
          onClick: handleCancel,
          disabled:
            wizardState.isProcessing ||
            wizardState.isAllocating ||
            wizardState.isEditingRules,
        }}
        backAction={
          canGoBack
            ? {
                label: translate("importCustomerPoints.wizard.buttons.back"),
                onClick: wizardState.goBack,
                disabled: isNextDisabled,
              }
            : undefined
        }
        nextAction={
          wizardState.currentStep < maxStep
            ? {
                label: translate("importCustomerPoints.wizard.buttons.next"),
                onClick: wizardState.goNext,
                disabled: !canGoNext || isNextDisabled,
              }
            : undefined
        }
        finishAction={
          wizardState.currentStep === maxStep
            ? {
                label: wizardState.isProcessing
                  ? translate("importCustomerPoints.wizard.buttons.processing")
                  : translate("importCustomerPoints.wizard.buttons.finish"),
                onClick: handleFinishImport,
                disabled: isFinishDisabled,
                loading: wizardState.isProcessing,
              }
            : undefined
        }
      />
    </WizardContainer>
  );
};
