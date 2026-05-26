"use client";
import { useState, useCallback } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { WizardContainer } from "src/components/wizard/wizard-container";
import { WizardHeader } from "src/components/wizard/wizard-header";
import { WizardContent } from "src/components/wizard/wizard-content";
import { WizardActions } from "src/components/wizard/wizard-actions";
import { DropZone } from "src/components/drop-zone";
import { useDialogState } from "src/components/dialog";
import { Selector, type SelectorOption } from "src/components/form/selector";
import { SuccessIcon, ErrorIcon } from "src/icons";
import {
  readZoneFeatures,
  type ReadZoneFeaturesResult,
} from "src/commands/read-zone-features";

const DATA_INPUT_STEP_NUMBER = 1;
const DATA_MAPPING_STEP_NUMBER = 2;
const COMPLETE_STEP_NUMBER = 3;

export const ImportZonesDialog = ({ onClose }: { onClose: () => void }) => {
  const translate = useTranslate();
  const { closeDialog } = useDialogState();
  const [currentStep, setCurrentStep] = useState(DATA_INPUT_STEP_NUMBER);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string>("none");
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [readResult, setReadResult] = useState<ReadZoneFeaturesResult | null>(
    null,
  );

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

  const handleFileDrop = useCallback((file: File) => {
    setSelectedFile(file);
    setFileError(null);
  }, []);

  const handleNextFromDataInput = useCallback(async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setFileError(null);

    const result = await readZoneFeatures(selectedFile);

    setIsProcessing(false);

    if (result.error) {
      setFileError(result.error);
      return;
    }

    setReadResult(result);
    setCurrentStep(DATA_MAPPING_STEP_NUMBER);
  }, [selectedFile]);

  const goNext = useCallback(() => {
    setCurrentStep((s) => Math.min(s + 1, COMPLETE_STEP_NUMBER));
  }, []);

  const goBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 1));
  }, []);

  const handleFinish = useCallback(() => {
    closeDialog();
  }, [closeDialog]);

  const availableProperties = readResult
    ? Array.from(readResult.uniqueProperties).sort()
    : [];
  const numZones = readResult?.features.length ?? 0;

  const footer =
    currentStep === DATA_INPUT_STEP_NUMBER ? (
      <WizardActions
        nextAction={{
          onClick: handleNextFromDataInput,
          disabled: !selectedFile,
          loading: isProcessing,
        }}
      />
    ) : currentStep === DATA_MAPPING_STEP_NUMBER ? (
      <WizardActions
        backAction={{ onClick: goBack }}
        nextAction={{ onClick: goNext }}
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
          />
        )}
        {currentStep === DATA_MAPPING_STEP_NUMBER && (
          <DataMappingStep
            selectedLabel={selectedLabel}
            availableProperties={availableProperties}
            onSelectLabel={setSelectedLabel}
          />
        )}
        {currentStep === COMPLETE_STEP_NUMBER && (
          <CompleteStep numZones={numZones} />
        )}
      </WizardContent>
    </WizardContainer>
  );
};

const DataInputStep = ({
  selectedFile,
  onFileDrop,
  error,
}: {
  selectedFile: File | null;
  onFileDrop: (file: File) => void;
  error: string | null;
}) => {
  const translate = useTranslate();

  return (
    <>
      <h2 className="text-lg font-semibold text-slate-900 pt-3 pb-3 dark:text-white">
        {translate("importZones.dataInputStep.addFromFile")}
      </h2>
      <DropZone
        onFileDrop={onFileDrop}
        accept=".geojson"
        supportedFormats="GeoJSON"
        selectedFile={selectedFile}
      />
      {error && (
        <div className="flex items-center gap-2 mt-3 p-3 rounded-md bg-red-50 text-red-700 text-sm">
          <ErrorIcon className="shrink-0" />
          {translate(`importZones.errors.${error}`)}
        </div>
      )}
    </>
  );
};

const DataMappingStep = ({
  selectedLabel,
  availableProperties,
  onSelectLabel,
}: {
  selectedLabel: string;
  availableProperties: string[];
  onSelectLabel: (value: string) => void;
}) => {
  const translate = useTranslate();

  const options: SelectorOption<string>[] = [
    {
      label: translate("importZones.dataMappingStep.none"),
      value: "none",
    },
    ...availableProperties.map((property) => ({
      label: property,
      value: property,
    })),
  ];

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-gray-700 mb-2">
        {translate("importZones.dataMappingStep.description")}
      </p>
      <Selector
        options={options}
        selected={selectedLabel}
        onChange={(value) => onSelectLabel(value)}
        ariaLabel={translate("importZones.dataMappingStep.description")}
      />
    </div>
  );
};

const CompleteStep = ({ numZones }: { numZones: number }) => {
  const translate = useTranslate();

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8">
      <SuccessIcon size="xl" className="text-green-600" />
      <p className="text-sm text-gray-700">
        {translate("importZones.completeStep.summary", numZones)}
      </p>
    </div>
  );
};
