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
import { useImportZones } from "src/commands/import-zones";
import { useUserTracking } from "src/infra/user-tracking";
import type { GisFiles } from "src/components/gis-drop-zone";
import { DataInputStep } from "./data-input-step";
import { DataMappingStep } from "./data-mapping-step";
import { CompleteStep } from "./complete-step";

const DATA_INPUT_STEP_NUMBER = 1;
const DATA_MAPPING_STEP_NUMBER = 2;
const COMPLETE_STEP_NUMBER = 3;

const stepNames = {
  [DATA_INPUT_STEP_NUMBER]: "dataInput",
  [DATA_MAPPING_STEP_NUMBER]: "dataMapping",
} as const;

export const ImportZonesDialog = ({ onClose }: { onClose: () => void }) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const { closeDialog } = useDialogState();
  const importZones = useImportZones();
  const { projections } = useProjections();
  const networkProjection = useAtomValue(projectSettingsAtom).projection;
  const [currentStep, setCurrentStep] = useState(DATA_INPUT_STEP_NUMBER);
  const [selectedGisFiles, setSelectedGisFiles] = useState<GisFiles>({});
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

  const processGisFiles = useCallback(
    async (gisFiles: GisFiles) => {
      setFileError(null);
      setReadResult(null);
      setIsProcessing(true);

      const primaryFile = gisFiles.geojson ?? gisFiles.shp;
      const result = await readZoneFeatures(gisFiles, projections);

      setIsProcessing(false);

      if (result.error) {
        userTracking.capture({
          name: "importZones.dataInput.parseError",
          fileName: primaryFile?.name ?? "unknown",
          errorCode: result.error,
        });
        setFileError(result.error);
        return;
      }

      userTracking.capture({
        name: "importZones.dataInput.fileLoaded",
        fileName: primaryFile?.name ?? "unknown",
        featuresCount: result.features.length,
        propertiesCount: result.uniqueProperties.size,
        coordinateConversion: !!result.coordinateConversion,
      });

      setReadResult(result);
    },
    [projections, userTracking],
  );

  const handleGisFilesDrop = useCallback(
    (gisFiles: GisFiles) => {
      setSelectedGisFiles(gisFiles);

      const hasGeojson = !!gisFiles.geojson;
      const hasShapefile = !!(gisFiles.shp && gisFiles.dbf && gisFiles.prj);

      if (hasGeojson || hasShapefile) {
        void processGisFiles(gisFiles);
      } else {
        setReadResult(null);
        setFileError(null);
      }
    },
    [processGisFiles],
  );

  const handleNextFromDataInput = useCallback(() => {
    if (!readResult) return;
    userTracking.capture({ name: "importZones.dataInput.next" });
    setCurrentStep(DATA_MAPPING_STEP_NUMBER);
  }, [readResult, userTracking]);

  const handleImport = useCallback(async () => {
    if (!readResult) return;

    userTracking.capture({ name: "importZones.dataMapping.next" });

    const labelProperty = selectedLabel === "none" ? undefined : selectedLabel;
    const result = await importZones(readResult.features, labelProperty);
    if (!result) return;
    setMergedZones(result.mergedZones);
    const zonesCount = Object.keys(result.zones).length;
    setImportedZoneCount(zonesCount);

    userTracking.capture({
      name: "importZones.completed",
      zonesCount,
      mergedCount: result.mergedZones.length,
    });

    setCurrentStep(COMPLETE_STEP_NUMBER);
  }, [readResult, selectedLabel, importZones, userTracking]);

  const goBack = useCallback(() => {
    userTracking.capture({ name: "importZones.dataMapping.back" });
    setCurrentStep((s) => Math.max(s - 1, 1));
  }, [userTracking]);

  const handleCancel = useCallback(() => {
    const stepName =
      stepNames[currentStep as keyof typeof stepNames] ?? "dataInput";
    userTracking.capture({
      name: `importZones.${stepName}.cancel` as
        | "importZones.dataInput.cancel"
        | "importZones.dataMapping.cancel",
    });
    onClose();
  }, [currentStep, userTracking, onClose]);

  const handleFinish = useCallback(() => {
    closeDialog();
  }, [closeDialog]);

  const handleSelectLabel = useCallback(
    (value: string) => {
      userTracking.capture({
        name: "importZones.dataMapping.selectLabel",
        property: value,
      });
      setSelectedLabel(value);
    },
    [userTracking],
  );

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
        onClose={handleCancel}
      />
      <WizardContent>
        {currentStep === DATA_INPUT_STEP_NUMBER && (
          <DataInputStep
            gisFiles={selectedGisFiles}
            onGisFilesDrop={handleGisFilesDrop}
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
            onSelectLabel={handleSelectLabel}
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
