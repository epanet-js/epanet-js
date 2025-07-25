import React, { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { DialogContainer } from "src/components/dialog";
import { useWizardState } from "./use-wizard-state";
import { DataInputStep } from "./data-input-step";
import { DemandOptionsStep } from "./demand-options-step";
import { useTranslate } from "src/hooks/use-translate";
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

  const handleClose = useCallback(() => {
    wizardState.reset();
    onClose();
  }, [wizardState, onClose]);

  const handleFinishImport = useCallback(() => {
    if (!wizardState.parsedCustomerPoints) {
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

        for (const customerPoint of wizardState.parsedCustomerPoints!) {
          const connection = connectCustomerPoint(
            mutableHydraulicModel,
            spatialIndexData,
            customerPoint,
            { keepDemands: wizardState.keepDemands },
          );

          if (!connection) {
            issues.addSkippedNoValidJunction();
          }
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

  const canGoNext =
    wizardState.currentStep === 1 && wizardState.parsedCustomerPoints !== null;
  const canGoBack = wizardState.currentStep === 2;
  const isNextDisabled = wizardState.isLoading || wizardState.isProcessing;
  const isFinishDisabled =
    wizardState.isProcessing || !wizardState.parsedCustomerPoints;

  return (
    <DialogContainer size="lg">
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gray-900">
              {translate("importCustomerPoints.wizard.title")}
            </h1>
          </div>

          <nav
            role="navigation"
            aria-label={translate("importCustomerPoints.wizard.stepsAriaLabel")}
            className="flex items-center space-x-4"
          >
            <div className="flex items-center">
              <div
                role="tab"
                aria-label="Step 1: Data Input"
                aria-current={
                  wizardState.currentStep === 1 ? "step" : undefined
                }
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  wizardState.currentStep >= 1
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                1
              </div>
              <span
                className={`ml-2 text-sm ${
                  wizardState.currentStep >= 1
                    ? "text-blue-600 font-medium"
                    : "text-gray-500"
                }`}
              >
                {translate("importCustomerPoints.wizard.dataInputStep")}
              </span>
            </div>

            <div className="flex-1">
              <div
                className={`h-px ${
                  wizardState.currentStep >= 2 ? "bg-blue-600" : "bg-gray-300"
                }`}
              />
            </div>

            <div className="flex items-center">
              <div
                role="tab"
                aria-label="Step 2: Demand Options"
                aria-current={
                  wizardState.currentStep === 2 ? "step" : undefined
                }
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  wizardState.currentStep >= 2
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                2
              </div>
              <span
                className={`ml-2 text-sm ${
                  wizardState.currentStep >= 2
                    ? "text-blue-600 font-medium"
                    : "text-gray-500"
                }`}
              >
                {translate("importCustomerPoints.wizard.demandOptionsStep")}
              </span>
            </div>
          </nav>
        </div>

        <div className="min-h-[300px]">
          {wizardState.currentStep === 1 && (
            <DataInputStep state={wizardState} actions={wizardState} />
          )}
          {wizardState.currentStep === 2 && (
            <DemandOptionsStep
              state={wizardState}
              actions={wizardState}
              onFinish={handleFinishImport}
            />
          )}
        </div>

        <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={wizardState.isProcessing}
          >
            {translate("importCustomerPoints.wizard.buttons.cancel")}
          </button>

          <div className="flex space-x-3">
            <button
              onClick={wizardState.goBack}
              disabled={!canGoBack || isNextDisabled}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {translate("importCustomerPoints.wizard.buttons.back")}
            </button>

            {wizardState.currentStep === 1 && (
              <button
                onClick={wizardState.goNext}
                disabled={!canGoNext || isNextDisabled}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {translate("importCustomerPoints.wizard.buttons.next")}
              </button>
            )}

            {wizardState.currentStep === 2 && (
              <button
                onClick={handleFinishImport}
                disabled={isFinishDisabled}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {wizardState.isProcessing
                  ? translate("importCustomerPoints.wizard.buttons.processing")
                  : translate("importCustomerPoints.wizard.buttons.finish")}
              </button>
            )}
          </div>
        </div>
      </div>
    </DialogContainer>
  );
};
