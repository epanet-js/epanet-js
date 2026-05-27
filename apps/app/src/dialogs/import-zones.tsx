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
import { EnhancedSelector } from "src/components/form/enhanced-selector";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { SuccessIcon, ErrorIcon } from "src/icons";
import {
  readZoneFeatures,
  type ReadZoneFeaturesResult,
  type ZoneFeature,
} from "src/commands/read-zone-features";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { useMemo } from "react";
import { useApplyZoneImport } from "src/commands/apply-zone-import";

const DATA_INPUT_STEP_NUMBER = 1;
const DATA_MAPPING_STEP_NUMBER = 2;
const COMPLETE_STEP_NUMBER = 3;
const PREVIEW_LIMIT = 10;

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
  const applyZoneImport = useApplyZoneImport();

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

  const handleImport = useCallback(() => {
    if (!readResult) return;

    const labelProperty = selectedLabel === "none" ? undefined : selectedLabel;
    applyZoneImport(readResult.features, labelProperty);

    setCurrentStep(COMPLETE_STEP_NUMBER);
  }, [readResult, selectedLabel, applyZoneImport]);

  const goBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 1));
  }, []);

  const handleFinish = useCallback(() => {
    closeDialog();
  }, [closeDialog]);

  const availableProperties = readResult
    ? Array.from(readResult.uniqueProperties)
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
  features,
  onSelectLabel,
}: {
  selectedLabel: string;
  availableProperties: string[];
  features: ZoneFeature[];
  onSelectLabel: (value: string) => void;
}) => {
  const translate = useTranslate();
  const isNewSelectorOn = useFeatureFlag("FLAG_SELECTOR");

  const noneLabel = translate("importZones.dataMappingStep.none");
  const propertyOptions = availableProperties.map((property) => ({
    label: property,
    value: property,
  }));
  const legacyOptions: SelectorOption<string>[] = [
    { label: noneLabel, value: "none" },
    ...propertyOptions,
  ];

  const previewLabels = useMemo(
    () => buildPreviewLabels(features, selectedLabel),
    [features, selectedLabel],
  );

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-gray-700 mb-2">
        {translate("importZones.dataMappingStep.description")}
      </p>
      {isNewSelectorOn ? (
        <EnhancedSelector
          nullable
          placeholder={noneLabel}
          clearLabel={noneLabel}
          options={propertyOptions}
          selected={selectedLabel === "none" ? null : selectedLabel}
          onChange={(value) => onSelectLabel(value ?? "none")}
          ariaLabel={translate("importZones.dataMappingStep.description")}
        />
      ) : (
        <Selector
          options={legacyOptions}
          selected={selectedLabel}
          onChange={(value) => onSelectLabel(value)}
          ariaLabel={translate("importZones.dataMappingStep.description")}
        />
      )}
      <LabelPreviewTable labels={previewLabels} totalCount={features.length} />
    </div>
  );
};

const LabelPreviewTable = ({
  labels,
  totalCount,
}: {
  labels: string[];
  totalCount: number;
}) => {
  const translate = useTranslate();

  return (
    <div className="mt-4 border border-gray-200 rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left px-3 py-2 font-medium text-gray-600">
              {translate("importZones.dataMappingStep.previewHeader")}
            </th>
          </tr>
        </thead>
        <tbody>
          {labels.map((label, i) => (
            <tr key={i} className="border-t border-gray-100">
              <td className="px-3 py-1.5 text-gray-700">{label}</td>
            </tr>
          ))}
          {totalCount > PREVIEW_LIMIT && (
            <tr className="border-t border-gray-100">
              <td className="px-3 py-1.5 text-gray-400 italic">
                {translate(
                  "importZones.dataMappingStep.previewMore",
                  String(totalCount - PREVIEW_LIMIT),
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>
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

const buildPreviewLabels = (
  features: ZoneFeature[],
  selectedLabel: string,
): string[] => {
  const preview = features.slice(0, PREVIEW_LIMIT);

  if (selectedLabel === "none") {
    const labelManager = new LabelManager();
    return preview.map((_, i) => labelManager.generateFor("zone", i + 1));
  }

  return preview.map((f) => String(f.properties?.[selectedLabel] ?? ""));
};
