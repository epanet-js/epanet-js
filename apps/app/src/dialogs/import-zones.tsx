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
import { SuccessIcon } from "src/icons";

const DATA_INPUT_STEP_NUMBER = 1;
const DATA_MAPPING_STEP_NUMBER = 2;
const COMPLETE_STEP_NUMBER = 3;

export const ImportZonesDialog = ({ onClose }: { onClose: () => void }) => {
  const translate = useTranslate();
  const { closeDialog } = useDialogState();
  const [currentStep, setCurrentStep] = useState(DATA_INPUT_STEP_NUMBER);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string>("none");

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
  }, []);

  const goNext = useCallback(() => {
    setCurrentStep((s) => Math.min(s + 1, COMPLETE_STEP_NUMBER));
  }, []);

  const goBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 1));
  }, []);

  const handleFinish = useCallback(() => {
    closeDialog();
  }, [closeDialog]);

  const availableProperties = ["mock1", "label", "zid"];
  const numZones = 5;

  const footer =
    currentStep === DATA_INPUT_STEP_NUMBER ? (
      <WizardActions
        nextAction={{ onClick: goNext, disabled: !selectedFile }}
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
}: {
  selectedFile: File | null;
  onFileDrop: (file: File) => void;
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
