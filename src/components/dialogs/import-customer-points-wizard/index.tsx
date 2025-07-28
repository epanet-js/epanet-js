import React, { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
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
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { dataAtom, dialogAtom } from "src/state/jotai";
import { connectCustomerPoint } from "src/hydraulic-model/mutations/connect-customer-point";
import { initializeCustomerPoints } from "src/hydraulic-model/customer-points";
import { createSpatialIndex } from "src/hydraulic-model/spatial-index";
import { getAssetsByType } from "src/__helpers__/asset-queries";
import { Pipe } from "src/hydraulic-model/asset-types/pipe";
import { CustomerPointsIssuesAccumulator } from "src/import/parse-customer-points-issues";
import { useUserTracking } from "src/infra/user-tracking";
import { captureError } from "src/infra/error-tracking";
import { notify } from "src/components/notifications";
import { CheckIcon } from "@radix-ui/react-icons";

type ImportCustomerPointsWizardProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const ImportCustomerPointsWizard: React.FC<
  ImportCustomerPointsWizardProps
> = ({ onClose }) => {
  const data = useAtomValue(dataAtom);
  const setData = useSetAtom(dataAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();
  const wizardState = useWizardState();
  const translate = useTranslate();
  const isAllocationOn = useFeatureFlag("FLAG_ALLOCATION");

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

  const handleFinishImport = useCallback(() => {
    const customerPoints =
      wizardState.parsedDataSummary?.validCustomerPoints ||
      wizardState.parsedCustomerPoints;
    if (!customerPoints || customerPoints.length === 0) {
      wizardState.setError("No customer points to import");
      return Promise.resolve();
    }

    return (async () => {
      try {
        wizardState.setProcessing(true);

        await new Promise((resolve) => setTimeout(resolve, 10));

        const pipes = getAssetsByType<Pipe>(data.hydraulicModel.assets, "pipe");
        const spatialIndexData = createSpatialIndex(pipes);
        const issues = new CustomerPointsIssuesAccumulator();

        const mutableHydraulicModel = {
          ...data.hydraulicModel,
          customerPoints: initializeCustomerPoints(),
        };

        for (const customerPoint of customerPoints) {
          connectCustomerPoint(
            mutableHydraulicModel,
            spatialIndexData,
            customerPoint,
            { keepDemands: wizardState.keepDemands },
          );
        }

        const finalIssues = issues.buildResult();
        const importedCount = mutableHydraulicModel.customerPoints.size;

        setData({
          ...data,
          hydraulicModel: mutableHydraulicModel,
        });

        if (importedCount === 0) {
          setDialogState({
            type: "customerPointsImportSummary",
            status: "error",
            count: 0,
            issues: finalIssues || undefined,
          });
          userTracking.capture({
            name: "importCustomerPoints.completedWithErrors",
            count: 0,
          });
        } else if (finalIssues) {
          setDialogState({
            type: "customerPointsImportSummary",
            status: "warning",
            count: importedCount,
            issues: finalIssues,
          });
          userTracking.capture({
            name: "importCustomerPoints.completedWithWarnings",
            count: importedCount,
            issuesCount: Object.keys(finalIssues).length,
          });
          notify({
            variant: "success",
            title: "Import Successful",
            description: `Successfully imported ${importedCount} customer points with some warnings`,
            Icon: CheckIcon,
          });
        } else {
          setDialogState({
            type: "customerPointsImportSummary",
            status: "success",
            count: importedCount,
          });
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
        }

        handleClose();
      } catch (error) {
        captureError(error as Error);
        wizardState.setError(`Import failed: ${(error as Error).message}`);
        userTracking.capture({
          name: "importCustomerPoints.unexpectedError",
          error: (error as Error).message,
        });
      }
    })();
  }, [wizardState, data, setData, setDialogState, userTracking, handleClose]);

  const maxStep = isAllocationOn ? 4 : 3;
  const canGoNext =
    (wizardState.currentStep === 1 && wizardState.parsedDataSummary !== null) ||
    (wizardState.currentStep === 2 && wizardState.parsedDataSummary !== null) ||
    (wizardState.currentStep === 3 && isAllocationOn);
  const canGoBack =
    wizardState.currentStep === 2 ||
    wizardState.currentStep === 3 ||
    (wizardState.currentStep === 4 && isAllocationOn);
  const isNextDisabled = wizardState.isLoading || wizardState.isProcessing;
  const isFinishDisabled =
    wizardState.isProcessing ||
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
    ...(isAllocationOn
      ? [
          {
            number: 4,
            label: "Customers Allocation",
            ariaLabel: "Step 4: Customers Allocation",
          },
        ]
      : []),
  ];

  return (
    <WizardContainer onDragOver={handleModalDragOver} onDrop={handleModalDrop}>
      <WizardHeader
        title={translate("importCustomerPoints.wizard.title")}
        steps={steps}
        currentStep={wizardState.currentStep}
      />

      <WizardContent>
        {wizardState.currentStep === 1 && (
          <DataInputStep state={wizardState} actions={wizardState} />
        )}
        {wizardState.currentStep === 2 && (
          <DataPreviewStep state={wizardState} actions={wizardState} />
        )}
        {wizardState.currentStep === 3 && (
          <DemandOptionsStep
            state={wizardState}
            actions={wizardState}
            onFinish={
              !isAllocationOn ? handleFinishImport : () => Promise.resolve()
            }
          />
        )}
        {wizardState.currentStep === 4 && isAllocationOn && (
          <AllocationStep state={wizardState} actions={wizardState} />
        )}
      </WizardContent>

      <WizardActions
        cancelAction={{
          label: translate("importCustomerPoints.wizard.buttons.cancel"),
          onClick: handleCancel,
          disabled: wizardState.isProcessing,
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
