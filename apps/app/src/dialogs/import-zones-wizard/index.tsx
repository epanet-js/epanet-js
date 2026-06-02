import { useState, useCallback } from "react";
import { useAtomValue } from "jotai";
import { useTranslate } from "src/hooks/use-translate";
import { WizardContainer } from "src/components/wizard/wizard-container";
import { WizardHeader } from "src/components/wizard/wizard-header";
import { WizardContent } from "src/components/wizard/wizard-content";
import { WizardActions } from "src/components/wizard/wizard-actions";
import { useDialogState } from "src/components/dialog";
import { useProjections } from "src/hooks/use-projections";
import { projectSettingsAtom } from "src/state/project-settings";
import {
  readZoneFeatures,
  getLabelProperties,
  type ReadZoneFeaturesResult,
  type MergedZoneInfo,
} from "src/lib/zones";
import { useImportZoneFeatures } from "src/commands/import-zone-features";
import { DataInputStep } from "./data-input-step";
import { DataMappingStep } from "./data-mapping-step";
import { CompleteStep } from "./complete-step";

const DATA_INPUT_STEP_NUMBER = 1;
const DATA_MAPPING_STEP_NUMBER = 2;
const COMPLETE_STEP_NUMBER = 3;

export const ImportZonesDialog = ({ onClose }: { onClose: () => void }) => {
  const translate = useTranslate();
  const { closeDialog } = useDialogState();
  const importZoneFeatures = useImportZoneFeatures();
  const { projections } = useProjections();
  const networkProjection = useAtomValue(projectSettingsAtom).projection;
  const [currentStep, setCurrentStep] = useState(DATA_INPUT_STEP_NUMBER);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string>("none");
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [readResult, setReadResult] = useState<ReadZoneFeaturesResult | null>(
    null,
  );
  const [mergedZones, setMergedZones] = useState<MergedZoneInfo[]>([]);
  const [importedZoneCount, setImportedZoneCount] = useState(0);

  const steps = [
    {
      number: DATA_INPUT_STEP_NUMBER,
      label: translate("importZones.dataInputStep.title"),
      ariaLabel: translate("importZones.dataInputStep.title"),
    },
    {
      number: DATA_MAPPING_STEP_NUMBER,
      label: translate("importZones.dataMappingStep.title"),
      ariaLabel: translate("importZones.dataMappingStep.title"),
    },
    {
      number: COMPLETE_STEP_NUMBER,
      label: translate("importZones.completeStep.title"),
      ariaLabel: translate("importZones.completeStep.title"),
    },
  ];

  const handleFileDrop = useCallback(
    async (file: File) => {
      setSelectedFile(file);
      setFileError(null);
      setReadResult(null);
      setIsProcessing(true);

      const result = await readZoneFeatures(file, projections);

      setIsProcessing(false);

      if (result.error) {
        setFileError(result.error);
        return;
      }

      setReadResult(result);
    },
    [projections],
  );

  const handleNextFromDataInput = useCallback(() => {
    if (!readResult) return;
    setCurrentStep(DATA_MAPPING_STEP_NUMBER);
  }, [readResult]);

  const handleImport = useCallback(async () => {
    if (!readResult) return;

    const labelProperty = selectedLabel === "none" ? undefined : selectedLabel;
    const result = await importZoneFeatures(readResult.features, labelProperty);
    setMergedZones(result.mergedZones);
    setImportedZoneCount(Object.keys(result.zones).length);

    setCurrentStep(COMPLETE_STEP_NUMBER);
  }, [readResult, selectedLabel, importZoneFeatures]);

  const goBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 1));
  }, []);

  const handleFinish = useCallback(() => {
    closeDialog();
  }, [closeDialog]);

  const availableProperties = readResult
    ? getLabelProperties(readResult.features)
    : [];

  const footer =
    currentStep === DATA_INPUT_STEP_NUMBER ? (
      <WizardActions
        nextAction={{
          onClick: handleNextFromDataInput,
          disabled: !readResult,
          loading: isProcessing,
        }}
      />
    ) : currentStep === DATA_MAPPING_STEP_NUMBER ? (
      <WizardActions
        backAction={{ onClick: goBack }}
        nextAction={{ onClick: handleImport }}
      />
    ) : (
      <WizardActions finishAction={{ onClick: handleFinish }} />
    );

  return (
    <WizardContainer footer={footer}>
      <WizardHeader
        title={translate("importZones.title")}
        steps={steps}
        currentStep={currentStep}
        onClose={onClose}
      />
      <WizardContent>
        {currentStep === DATA_INPUT_STEP_NUMBER && (
          <DataInputStep
            selectedFile={selectedFile}
            onFileDrop={handleFileDrop}
            error={fileError}
            showNoProjectionWarning={
              readResult !== null && !readResult.coordinateConversion
            }
            networkProjectionName={networkProjection.name}
          />
        )}
        {currentStep === DATA_MAPPING_STEP_NUMBER && (
          <DataMappingStep
            selectedLabel={selectedLabel}
            availableProperties={availableProperties}
            features={readResult?.features ?? []}
            onSelectLabel={setSelectedLabel}
          />
        )}
        {currentStep === COMPLETE_STEP_NUMBER && (
          <CompleteStep
            numZones={importedZoneCount}
            mergedZones={mergedZones}
          />
        )}
      </WizardContent>
    </WizardContainer>
  );
};
