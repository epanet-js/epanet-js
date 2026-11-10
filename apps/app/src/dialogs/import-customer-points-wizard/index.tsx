import React, { useCallback, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useAtomValue } from "jotai";
import { Callout } from "@epanet-js/ui-kit";
import { ErrorIcon } from "src/icons";
import {
  WizardContainer,
  WizardHeader,
  WizardContent,
  WizardActions,
  type Step,
} from "src/components/wizard";
import { awaitsCoordinates, useWizardState } from "./use-wizard-state";
import { DataInputStep } from "./data-input-step";
import { DataMappingStep } from "./data-mapping-step";
import { DemandOptionsStep } from "./demand-options-step";
import { useTranslate } from "src/hooks/use-translate";
import { useAuth } from "src/hooks/use-auth";
import { useUserTracking } from "src/infra/user-tracking";
import { EarlyAccessBadge } from "src/components/early-access-badge";
import { useProjections } from "src/hooks/use-projections";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { addCustomerPoints } from "src/hydraulic-model/mutations/add-customer-points";
import { useCustomerPointsImportReset } from "src/hooks/persistence/use-customer-points-import-reset";
import { useImportCustomerPoints } from "src/commands/import-customer-points";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { notify } from "src/components/notifications";
import { SuccessIcon } from "src/icons";
import type { ParsedDataSummary } from "./types";
import { ImportProgressPanel, type ImportProgress } from "./import-progress";
import { modelFactoriesAtom } from "src/state/model-factories";
import { CustomerPointFactory, LabelManager } from "@epanet-js/hydraulic-model";
import { isAbortError } from "src/infra/abort";
import { waitForPaint } from "src/infra/yield-to-main";
const stepNames = {
  1: "dataInput",
  2: "dataMapping",
  3: "demandOptions",
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
  const { isSignedIn, isLoaded } = useAuth();
  const showEarlyAccess = isLoaded && !isSignedIn;
  const {
    projections,
    loading: projectionsLoading,
    error: projectionsError,
  } = useProjections();

  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { customerPointsImportReset } = useCustomerPointsImportReset();
  const importCustomerPoints = useImportCustomerPoints();
  const isCpImportChangesetOn = useFeatureFlag("FLAG_CP_IMPORT_CHANGESET");
  const { idPools } = useAtomValue(modelFactoriesAtom);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(
    null,
  );
  const buildAbort = useRef<AbortController | null>(null);

  const handleClose = useCallback(() => {
    buildAbort.current?.abort();
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

  const applyWithReset = useCallback(
    (summary: ParsedDataSummary, keepDemands: boolean): number => {
      const updatedHydraulicModel = addCustomerPoints(
        hydraulicModel,
        summary.validCustomerPoints,
        {
          preserveJunctionDemands: keepDemands,
          customerPointDemands: summary.customerPointDemands,
          customAttributes: summary.attributes?.definition,
        },
      );

      void customerPointsImportReset({
        hydraulicModel: updatedHydraulicModel,
        idGenerator: summary.idGenerator,
      });

      return updatedHydraulicModel.customerPoints.size;
    },
    [hydraulicModel, customerPointsImportReset],
  );

  const applyWithChangeSet = useCallback(
    async (
      summary: ParsedDataSummary,
      keepDemands: boolean,
    ): Promise<number | null> => {
      if (!summary.buildAll) return null;

      const controller = new AbortController();
      buildAbort.current = controller;
      const showProgress = (progress: ImportProgress) =>
        flushSync(() => setImportProgress(progress));

      let shownPercent = 0;
      showProgress({ phase: "building", fraction: 0 });
      await waitForPaint();

      const { customerPoints, demands } = await summary.buildAll(
        new CustomerPointFactory(
          idPools.forPool("customerPoint"),
          new LabelManager(),
        ),
        {
          signal: controller.signal,
          onProgress: (processed, total) => {
            const fraction = total === 0 ? 1 : processed / total;
            const percent = Math.floor(fraction * 100);
            if (percent === shownPercent) return;
            shownPercent = percent;
            showProgress({ phase: "building", fraction });
          },
        },
      );

      showProgress({ phase: "applying" });
      await waitForPaint();

      const applied = importCustomerPoints({
        customerPoints,
        customerPointDemands: demands,
        preserveJunctionDemands: keepDemands,
        customAttributes: summary.attributes?.definition,
      });

      return applied ? customerPoints.length : null;
    },
    [importCustomerPoints, idPools],
  );

  const handleFinish = useCallback(async () => {
    const { parsedDataSummary, keepDemands, setProcessing, setError } =
      wizardState;
    if (!parsedDataSummary) return;

    setProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 10));

    try {
      const importedCount = isCpImportChangesetOn
        ? await applyWithChangeSet(parsedDataSummary, keepDemands)
        : applyWithReset(parsedDataSummary, keepDemands);
      if (importedCount === null) return;

      userTracking.capture({
        name: "importCustomerPoints.completed",
        count: importedCount,
        allocatedCount: 0,
        disconnectedCount: importedCount,
        rulesCount: 0,
      });

      notify({
        variant: "success",
        title: translate("importSuccessful"),
        Icon: SuccessIcon,
      });

      handleClose();
    } catch (error) {
      if (isAbortError(error)) return;
      setError("Import failed. Please try again.");
    } finally {
      setProcessing(false);
      setImportProgress(null);
    }
  }, [
    wizardState,
    isCpImportChangesetOn,
    applyWithChangeSet,
    applyWithReset,
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
  ];

  const {
    currentStep,
    inputData,
    isLoading,
    parsedDataSummary,
    isProcessing,
    error,
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
                awaitsCoordinates(wizardState) ||
                !!error ||
                (parsedDataSummary
                  ? parsedDataSummary.validCount === 0
                  : !inputData),
            }}
          />
        );
      case 3:
        return (
          <WizardActions
            backAction={{ onClick: handleBack }}
            finishAction={{
              onClick: handleFinish,
              disabled: isProcessing,
              loading: isProcessing,
              label: isProcessing
                ? translate("wizard.processing")
                : translate(
                    "importCustomerPoints.wizard.allocationStep.applyChanges",
                  ),
            }}
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
        badge={showEarlyAccess ? <EarlyAccessBadge /> : undefined}
      />

      <WizardContent>
        {projectionsLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-subtle">
              {translate("importCustomerPoints.wizard.loading")}
            </span>
          </div>
        )}

        {projectionsError && (
          <Callout
            variant="error"
            description={translate(
              "importCustomerPoints.wizard.somethingWentWrong",
            )}
            Icon={ErrorIcon}
            className="mb-6 border rounded-md"
          />
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
                projections={projections}
              />
            )}
            {currentStep === 3 && !importProgress && (
              <DemandOptionsStep
                onNext={handleNext}
                onBack={handleBack}
                renderActions={false}
                wizardState={wizardState}
              />
            )}
            {currentStep === 3 && importProgress && (
              <ImportProgressPanel progress={importProgress} />
            )}
          </>
        )}
      </WizardContent>
    </WizardContainer>
  );
};
