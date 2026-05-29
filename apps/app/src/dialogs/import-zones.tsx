"use client";
import { useState, useCallback } from "react";
import { useAtomValue } from "jotai";
import { useTranslate } from "src/hooks/use-translate";
import { WizardContainer } from "src/components/wizard/wizard-container";
import { WizardHeader } from "src/components/wizard/wizard-header";
import { WizardContent } from "src/components/wizard/wizard-content";
import { WizardActions } from "src/components/wizard/wizard-actions";
import { DropZone } from "src/components/drop-zone";
import { useDialogState } from "src/components/dialog";
import { Selector } from "src/components/form/selector";
import { useProjections } from "src/hooks/use-projections";
import { projectSettingsAtom } from "src/state/project-settings";
import { SuccessIcon, ErrorIcon } from "src/icons";
import {
  readZoneFeatures,
  ZoneLabelGenerator,
  getLabelProperties,
  type ReadZoneFeaturesResult,
  type ZoneFeature,
} from "src/lib/zones";
import { useImportZoneFeatures } from "src/commands/import-zone-features";
import { useMemo } from "react";

const DATA_INPUT_STEP_NUMBER = 1;
const DATA_MAPPING_STEP_NUMBER = 2;
const COMPLETE_STEP_NUMBER = 3;
const PREVIEW_LIMIT = 7;

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
    await importZoneFeatures(readResult.features, labelProperty);

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
  const numZones = readResult?.features.length ?? 0;

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
  showNoProjectionWarning,
  networkProjectionName,
}: {
  selectedFile: File | null;
  onFileDrop: (file: File) => void;
  error: string | null;
  showNoProjectionWarning: boolean;
  networkProjectionName: string;
}) => {
  const translate = useTranslate();

  return (
    <>
      <h2 className="text-size-heading-3 font-semibold text-slate-900 pt-3 pb-3 dark:text-white">
        {translate("importZones.dataInputStep.addFromFile")}
      </h2>
      <DropZone
        onFileDrop={onFileDrop}
        accept=".geojson"
        supportedFormats="GeoJSON"
        selectedFile={selectedFile}
      />
      {error && (
        <div className="flex items-center gap-2 mt-3 p-3 rounded-md bg-error-subtle text-red-700 text-size-base dark:bg-red-950 dark:text-red-300">
          <ErrorIcon className="shrink-0" />
          {translate(`importZones.errors.${error}`)}
        </div>
      )}
      {showNoProjectionWarning && (
        <div className="flex items-center gap-2 mt-3 p-3 rounded-md bg-blue-50 text-blue-700 text-size-base dark:bg-blue-950 dark:text-blue-300">
          {translate(
            "importZones.dataInputStep.noProjectionWarning",
            networkProjectionName,
          )}
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

  const noneLabel = translate("importZones.dataMappingStep.none");
  const propertyOptions = availableProperties.map((property) => ({
    label: property,
    value: property,
  }));

  const previewLabels = useMemo(
    () => buildPreviewLabels(features, selectedLabel),
    [features, selectedLabel],
  );

  return (
    <div className="flex flex-col gap-2">
      <p className="text-size-base text-default mb-2">
        {translate("importZones.dataMappingStep.description")}
      </p>
      <Selector
        nullable
        placeholder={noneLabel}
        clearLabel={noneLabel}
        options={propertyOptions}
        selected={selectedLabel === "none" ? null : selectedLabel}
        onChange={(value) => onSelectLabel(value ?? "none")}
        ariaLabel={translate("importZones.dataMappingStep.description")}
      />
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
    <div className="mt-4 border rounded-md overflow-hidden">
      <table className="w-full text-size-base">
        <thead>
          <tr className="bg-panel">
            <th className="text-left px-3 py-2 font-medium text-subtle">
              {translate("importZones.dataMappingStep.previewHeader")}
            </th>
          </tr>
        </thead>
        <tbody>
          {labels.map((label, i) => (
            <tr key={i} className="border-t border-gray-100">
              <td className="px-3 py-1.5 text-default">{label}</td>
            </tr>
          ))}
          {totalCount > PREVIEW_LIMIT && (
            <tr className="border-t border-gray-100">
              <td className="px-3 py-1.5 text-subtle italic">
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
      <p className="text-size-base text-default">
        {translate("importZones.completeStep.summary", numZones.toString())}
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
    const generator = new ZoneLabelGenerator();
    return preview.map(() => generator.next());
  }

  return preview.map((f) => String(f.properties?.[selectedLabel] ?? ""));
};
