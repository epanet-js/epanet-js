import React, { useCallback } from "react";
import {
  WizardContainer,
  WizardHeader,
  WizardContent,
  type Step,
} from "src/components/wizard";
import { useWizardState } from "./use-wizard-state";
import { DataInputStep } from "./data-input-step";
import { DataMappingStep } from "./data-mapping-step";
import { DemandOptionsStep } from "./demand-options-step";
import { AllocationStep } from "./allocation-step";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import { EarlyAccessBadge } from "src/components/early-access-badge";
import { useProjections } from "src/hooks/use-projections";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

const stepNames = {
  1: "dataInput",
  2: "dataMapping",
  3: "demandOptions",
  4: "allocation",
} as const;

type ImportCustomerPointsWizardProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const ImportCustomerPointsWizard: React.FC<
  ImportCustomerPointsWizardProps
> = ({ onClose }) => {
  const userTracking = useUserTracking();
  const wizardState = useWizardState();
  const translate = useTranslate();
  const isDataMappingOn = useFeatureFlag("FLAG_DATA_MAPPING");
  const {
    projections,
    loading: projectionsLoading,
    error: projectionsError,
  } = useProjections();

  const handleClose = useCallback(() => {
    wizardState.reset();
    onClose();
  }, [wizardState, onClose]);

  const handleNext = useCallback(() => {
    const currentStepName = stepNames[wizardState.currentStep];

    userTracking.capture({
      name: `importCustomerPoints.${currentStepName}.next` as const,
    });

    wizardState.goNext();
  }, [wizardState, userTracking]);

  const handleBack = useCallback(() => {
    const currentStepName = stepNames[wizardState.currentStep];

    userTracking.capture({
      name: `importCustomerPoints.${currentStepName}.back` as const,
    });

    wizardState.goBack();
  }, [wizardState, userTracking]);

  const handleCancel = useCallback(() => {
    const currentStepName = stepNames[wizardState.currentStep];

    userTracking.capture({
      name: `importCustomerPoints.${currentStepName}.cancel` as const,
    });

    handleClose();
  }, [userTracking, handleClose, wizardState.currentStep]);

  const handleFinish = useCallback(() => {
    handleClose();
  }, [handleClose]);

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
      label: translate("importCustomerPoints.wizard.allocationStepLabel"),
      ariaLabel: "Step 4: Customers Allocation",
    },
  ];

  return (
    <WizardContainer onDragOver={handleModalDragOver} onDrop={handleModalDrop}>
      <WizardHeader
        title={translate("importCustomerPoints.wizard.title")}
        steps={steps}
        currentStep={wizardState.currentStep}
        onClose={handleCancel}
        badge={<EarlyAccessBadge />}
      />

      <WizardContent>
        {isDataMappingOn && projectionsLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600">
              {translate("importCustomerPoints.wizard.loading")}
            </span>
          </div>
        )}

        {isDataMappingOn && projectionsError && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <p className="text-red-700 text-sm">
              {translate("importCustomerPoints.wizard.somethingWentWrong")}
            </p>
          </div>
        )}

        {(!isDataMappingOn || (!projectionsLoading && !projectionsError)) && (
          <>
            {wizardState.currentStep === 1 && (
              <DataInputStep
                onNext={handleNext}
                wizardState={wizardState}
                projections={projections}
              />
            )}
            {wizardState.currentStep === 2 && (
              <DataMappingStep
                onNext={handleNext}
                onBack={handleBack}
                wizardState={wizardState}
              />
            )}
            {wizardState.currentStep === 3 && (
              <DemandOptionsStep
                onNext={handleNext}
                onBack={handleBack}
                wizardState={wizardState}
              />
            )}
            {wizardState.currentStep === 4 && (
              <AllocationStep
                onBack={handleBack}
                onFinish={handleFinish}
                wizardState={wizardState}
              />
            )}
          </>
        )}
      </WizardContent>
    </WizardContainer>
  );
};
