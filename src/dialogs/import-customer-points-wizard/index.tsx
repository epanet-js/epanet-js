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
import { DataMappingStep } from "./data-mapping-step";
import { DemandOptionsStep } from "./demand-options-step";
import { AllocationStep } from "./allocation-step";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import { EarlyAccessBadge } from "src/components/early-access-badge";
import { useProjections } from "src/hooks/use-projections";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { modelFactoriesAtom } from "src/state/model-factories";

import { simulationSettingsAtom } from "src/state/simulation-settings";
import { simulationSettingsDerivedAtom } from "src/state/derived-branch-state";
import { projectSettingsAtom } from "src/state/project-settings";
import { addCustomerPoints } from "src/hydraulic-model/mutations/add-customer-points";
import { usePersistence } from "src/lib/persistence";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useProjectInitialization } from "src/hooks/persistence/use-project-initialization";
import { notify } from "src/components/notifications";
import { SuccessIcon } from "src/icons";
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
  const {
    projections,
    loading: projectionsLoading,
    error: projectionsError,
  } = useProjections();

  const isStateRefactorOn = useFeatureFlag("FLAG_STATE_REFACTOR");
  const hydraulicModel = useAtomValue(
    isStateRefactorOn ? stagingModelDerivedAtom : stagingModelAtom,
  );
  const factories = useAtomValue(modelFactoriesAtom);
  const projectSettings = useAtomValue(projectSettingsAtom);
  const rep = usePersistence();
  const transactImportDeprecated = rep.useTransactImportDeprecated();
  const simulationSettings = useAtomValue(
    isStateRefactorOn ? simulationSettingsDerivedAtom : simulationSettingsAtom,
  );
  const { initializeProject } = useProjectInitialization();

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

  const handleFinish = useCallback(async () => {
    const {
      allocationResult,
      allocationRules,
      keepDemands,
      parsedDataSummary,
      setProcessing,
      setError,
    } = wizardState;
    if (!allocationResult) return;

    setProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 10));

    try {
      const customerPointsToAdd = [
        ...allocationResult.allocatedCustomerPoints.values(),
        ...allocationResult.disconnectedCustomerPoints.values(),
      ];

      const updatedHydraulicModel = addCustomerPoints(
        hydraulicModel,
        customerPointsToAdd,
        {
          preserveJunctionDemands: keepDemands,
          overrideExisting: true,
          customerPointDemands: parsedDataSummary?.customerPointDemands,
        },
      );

      const importedCount = updatedHydraulicModel.customerPoints.size;

      if (isStateRefactorOn) {
        void initializeProject({
          hydraulicModel: updatedHydraulicModel,
          factories,
          projectSettings,
          simulationSettings,
        });
      } else {
        transactImportDeprecated(
          updatedHydraulicModel,
          factories,
          projectSettings,
          "customerpoints",
          simulationSettings,
        );
      }

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

      handleClose();
    } catch {
      setError("Import failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  }, [
    wizardState,
    hydraulicModel,
    factories,
    projectSettings,
    simulationSettings,
    isStateRefactorOn,
    initializeProject,
    transactImportDeprecated,
    userTracking,
    translate,
    handleClose,
  ]);

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

  const {
    currentStep,
    inputData,
    isLoading,
    selectedDemandProperty,
    parsedDataSummary,
    isProcessing,
    isAllocating,
    isEditingRules,
    allocationResult,
  } = wizardState;

  const footer = (() => {
    switch (currentStep) {
      case 1:
        return (
          <WizardActions
            nextAction={{ onClick: handleNext, disabled: !inputData }}
          />
        );
      case 2:
        return (
          <WizardActions
            backAction={{ onClick: handleBack, disabled: isLoading }}
            nextAction={{
              onClick: handleNext,
              disabled:
                isLoading ||
                !selectedDemandProperty ||
                (parsedDataSummary
                  ? parsedDataSummary.validCustomerPoints.length === 0
                  : false),
            }}
          />
        );
      case 3:
        return (
          <WizardActions
            backAction={{ onClick: handleBack }}
            nextAction={{ onClick: handleNext }}
          />
        );
      case 4:
        return (
          <WizardActions
            backAction={{
              onClick: handleBack,
              disabled: isProcessing || isAllocating || isEditingRules,
            }}
            finishAction={
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
                  }
            }
          />
        );
    }
  })();

  return (
    <WizardContainer
      onDragOver={handleModalDragOver}
      onDrop={handleModalDrop}
      footer={footer}
    >
      <WizardHeader
        title={translate("importCustomerPoints.wizard.title")}
        steps={steps}
        currentStep={wizardState.currentStep}
        onClose={handleCancel}
        badge={<EarlyAccessBadge />}
      />

      <WizardContent>
        {projectionsLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600">
              {translate("importCustomerPoints.wizard.loading")}
            </span>
          </div>
        )}

        {projectionsError && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <p className="text-red-700 text-sm">
              {translate("importCustomerPoints.wizard.somethingWentWrong")}
            </p>
          </div>
        )}

        {!projectionsLoading && !projectionsError && (
          <>
            {currentStep === 1 && (
              <DataInputStep
                onNext={handleNext}
                renderActions={false}
                wizardState={wizardState}
                projections={projections}
              />
            )}
            {currentStep === 2 && (
              <DataMappingStep
                onNext={handleNext}
                onBack={handleBack}
                renderActions={false}
                wizardState={wizardState}
              />
            )}
            {currentStep === 3 && (
              <DemandOptionsStep
                onNext={handleNext}
                onBack={handleBack}
                renderActions={false}
                wizardState={wizardState}
              />
            )}
            {currentStep === 4 && (
              <AllocationStep
                onBack={handleBack}
                onFinish={handleClose}
                renderActions={false}
                wizardState={wizardState}
              />
            )}
          </>
        )}
      </WizardContent>
    </WizardContainer>
  );
};
