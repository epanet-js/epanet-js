import React, { useCallback, useEffect, useMemo } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { useUserTracking } from "src/infra/user-tracking";
import { useAtomValue } from "jotai";
import { projectSettingsAtom } from "src/state/project-settings";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { modelFactoriesAtom } from "src/state/model-factories";
import {
  buildCustomerPointPreviewFactory,
  CustomerPoint,
  CustomerPointId,
  MAX_CUSTOMER_POINT_LABEL_LENGTH,
} from "@epanet-js/hydraulic-model";
import { parseCustomerPoints } from "src/import/customer-points/parse-customer-points";
import { CustomerPointsIssuesAccumulator } from "src/import/customer-points/parse-customer-points-issues";
import { Demand } from "src/hydraulic-model/demands";
import { localizeDecimal } from "src/infra/i18n/numbers";
import {
  WizardState,
  WizardActions,
  ParsedDataSummary,
  InputData,
} from "./types";
import { UnitsSpec } from "src/lib/project-settings/quantities-spec";
import { WizardActions as WizardActionsComponent } from "src/components/wizard";
import { Selector } from "src/components/form/selector";
import { NumericField } from "src/components/form/numeric-field";
import { CustomerPointsTable, IssuesSummary } from "./data-mapping-step";
const CONSTANT_PATTERN_ID = 0;

export const DataMappingStepFlexible: React.FC<{
  onNext: () => void;
  onBack: () => void;
  renderActions?: boolean;
  wizardState: WizardState & WizardActions & { units: UnitsSpec };
}> = ({ onNext, onBack, renderActions = true, wizardState }) => {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const userTracking = useUserTracking();
  const projectSettings = useAtomValue(projectSettingsAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { labelManager } = useAtomValue(modelFactoriesAtom);
  const patterns = hydraulicModel.patterns;
  const customerDemandPerDayUnit = projectSettings.units.customerDemandPerDay;
  const {
    parsedDataSummary,
    error,
    inputData,
    selectedFile,
    selectedDemandProperty,
    selectedLabelProperty,
    selectedPatternId,
    defaultDemand,
    setLoading,
    setError,
    setParsedDataSummary,
    setSelectedDemandProperty,
    setSelectedLabelProperty,
    setSelectedPatternId,
    setDefaultDemand,
    isLoading,
  } = wizardState;

  const constantLabel = translate("constant");
  const realPatternOptions = useMemo(() => {
    const options: { value: number; label: string }[] = [];
    for (const [patternId, { label }] of patterns.entries()) {
      options.push({ value: patternId, label });
    }
    return options;
  }, [patterns]);

  const parseInputDataToCustomerPoints = useCallback(
    (
      inputData: InputData,
      demandPropertyName: string | null,
      labelPropertyName: string | null = null,
      patternId: number | null = null,
      defaultDemandValue: number = 0,
    ) => {
      setLoading(true);
      setError(null);

      setTimeout(() => {
        try {
          const issues = new CustomerPointsIssuesAccumulator();
          const validCustomerPoints: CustomerPoint[] = [];
          const customerPointDemands = new Map<CustomerPointId, Demand[]>();
          let totalCount = 0;

          const demandImportUnit = projectSettings.units.customerDemandPerDay;
          const demandTargetUnit = projectSettings.units.customerDemand;

          const fileContent = JSON.stringify({
            type: "FeatureCollection",
            features: inputData.features,
          });

          const previewFactory = buildCustomerPointPreviewFactory(labelManager);

          for (const parsed of parseCustomerPoints(
            fileContent,
            issues,
            demandImportUnit,
            demandTargetUnit,
            previewFactory,
            demandPropertyName,
            labelPropertyName,
            patternId,
            defaultDemandValue,
          )) {
            totalCount++;
            if (parsed) {
              validCustomerPoints.push(parsed.customerPoint);
              customerPointDemands.set(parsed.customerPoint.id, parsed.demands);
            }
          }

          const parsedDataSummary: ParsedDataSummary = {
            validCustomerPoints,
            customerPointDemands,
            issues: issues.buildResult(),
            totalCount,
            demandImportUnit,
          };

          if (validCustomerPoints.length === 0) {
            userTracking.capture({
              name: "importCustomerPoints.dataMapping.noValidPoints",
              fileName: selectedFile!.name,
            });
          }

          setParsedDataSummary(parsedDataSummary);
          setLoading(false);

          userTracking.capture({
            name: "importCustomerPoints.dataMapping.customerPointsLoaded",
            validCount: validCustomerPoints.length,
            issuesCount: issues.count(),
            totalCount,
            fileName: selectedFile!.name,
          });
        } catch (error) {
          userTracking.capture({
            name: "importCustomerPoints.dataMapping.parseError",
            fileName: selectedFile!.name,
          });
          setError(translate("importCustomerPoints.dataSource.parseFileError"));
        }
      }, 50);
    },
    [
      setLoading,
      setError,
      projectSettings.units,
      labelManager,
      setParsedDataSummary,
      userTracking,
      selectedFile,
      translate,
    ],
  );

  const handleDemandPropertyChange = useCallback(
    (property: string | null) => {
      userTracking.capture({
        name: "importCustomerPoints.dataMapping.selectDemand",
        property: property ?? "(default)",
      });
      setSelectedDemandProperty(property);
      if (!inputData) return;
      setParsedDataSummary(null);
      parseInputDataToCustomerPoints(
        inputData,
        property,
        selectedLabelProperty,
        selectedPatternId,
        defaultDemand,
      );
    },
    [
      userTracking,
      setSelectedDemandProperty,
      setParsedDataSummary,
      parseInputDataToCustomerPoints,
      inputData,
      selectedLabelProperty,
      selectedPatternId,
      defaultDemand,
    ],
  );

  const handleDefaultDemandChange = useCallback(
    (value: number) => {
      const safeValue = isNaN(value) ? 0 : value;
      setDefaultDemand(safeValue);
      if (!inputData || selectedDemandProperty) return;
      setParsedDataSummary(null);
      parseInputDataToCustomerPoints(
        inputData,
        null,
        selectedLabelProperty,
        selectedPatternId,
        safeValue,
      );
    },
    [
      setDefaultDemand,
      setParsedDataSummary,
      parseInputDataToCustomerPoints,
      inputData,
      selectedDemandProperty,
      selectedLabelProperty,
      selectedPatternId,
    ],
  );

  const handleLabelPropertyChange = useCallback(
    (property: string) => {
      userTracking.capture({
        name: "importCustomerPoints.dataMapping.selectLabel",
        property,
      });
      setSelectedLabelProperty(property);
      if (!inputData) return;
      setParsedDataSummary(null);
      parseInputDataToCustomerPoints(
        inputData,
        selectedDemandProperty,
        property,
        selectedPatternId,
        defaultDemand,
      );
    },
    [
      userTracking,
      setSelectedLabelProperty,
      selectedDemandProperty,
      setParsedDataSummary,
      parseInputDataToCustomerPoints,
      inputData,
      selectedPatternId,
      defaultDemand,
    ],
  );

  const handlePatternChange = useCallback(
    (rawPatternId: number) => {
      const patternId = rawPatternId ? rawPatternId : null;
      setSelectedPatternId(patternId);
      if (inputData) {
        setParsedDataSummary(null);
        parseInputDataToCustomerPoints(
          inputData,
          selectedDemandProperty,
          selectedLabelProperty,
          patternId,
          defaultDemand,
        );
      }
      userTracking.capture({
        name: "importCustomerPoints.dataMapping.selectPattern",
        patternId: patternId ? patterns.get(patternId)!.label : "CONSTANT",
      });
    },
    [
      userTracking,
      setSelectedPatternId,
      selectedDemandProperty,
      setParsedDataSummary,
      parseInputDataToCustomerPoints,
      inputData,
      selectedLabelProperty,
      patterns,
      defaultDemand,
    ],
  );

  useEffect(() => {
    if (inputData && !parsedDataSummary && !isLoading && !error) {
      parseInputDataToCustomerPoints(
        inputData,
        selectedDemandProperty,
        selectedLabelProperty,
        selectedPatternId,
        defaultDemand,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputData]);

  const showAttributesMapping = !!inputData;
  const showLoading = inputData && isLoading && !parsedDataSummary;
  const showDataPreview = parsedDataSummary;
  const showNoDataMessage = !inputData;
  const validCount = parsedDataSummary?.validCustomerPoints.length || 0;
  const MAX_PREVIEW_ROWS = 15;

  const isNextDisabled =
    isLoading || (parsedDataSummary ? validCount === 0 : !inputData);

  return (
    <>
      <div className="overflow-y-auto grow scroll-shadows">
        <h2 className="text-size-heading-3 font-semibold">
          {translate("importCustomerPoints.wizard.dataMapping.title")}
        </h2>

        {showAttributesMapping && (
          <div className="space-y-2">
            <div>
              <p className="text-size-base text-subtle mt-2 mb-4">
                {translate(
                  "importCustomerPoints.wizard.dataMapping.attributesMapping.description",
                )}
              </p>
              <div className="space-y-4 md:grid md:gap-4 md:space-y-0 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-size-base text-default mb-2">
                    {`${translate(
                      "importCustomerPoints.wizard.dataMapping.labelSelector.label",
                    )} (${translate("optional")})`}
                  </label>
                  <Selector
                    nullable={true}
                    placeholder={translate(
                      "importCustomerPoints.wizard.dataMapping.labelSelector.placeholder",
                    )}
                    options={Array.from(inputData.properties).map((prop) => ({
                      label: prop,
                      value: prop,
                    }))}
                    selected={selectedLabelProperty || null}
                    clearLabel={translate(
                      "importCustomerPoints.wizard.dataMapping.labelSelector.noneAutoGenerate",
                    )}
                    onChange={(value) => handleLabelPropertyChange(value ?? "")}
                    ariaLabel={translate(
                      "importCustomerPoints.wizard.dataMapping.labelSelector.label",
                    )}
                  />
                  <p className="text-size-small text-subtle mt-1">
                    {translate(
                      "importCustomerPoints.wizard.dataMapping.labelSelector.description",
                      String(MAX_CUSTOMER_POINT_LABEL_LENGTH),
                    )}
                  </p>
                </div>
                <div>
                  <label className="block text-size-base text-default mb-2">
                    {`${translate(
                      "importCustomerPoints.wizard.dataMapping.demandSelector.label",
                    )} (${translate("optional")})`}
                  </label>
                  <Selector
                    nullable={true}
                    placeholder={translate(
                      "importCustomerPoints.wizard.dataMapping.demandSelector.placeholder",
                    )}
                    options={Array.from(inputData.properties).map((prop) => ({
                      label: prop,
                      value: prop,
                    }))}
                    selected={selectedDemandProperty}
                    clearLabel={translate(
                      "importCustomerPoints.wizard.dataMapping.demandSelector.noneUseDefault",
                    )}
                    onChange={(value) =>
                      handleDemandPropertyChange(value ?? null)
                    }
                    ariaLabel={translate(
                      "importCustomerPoints.wizard.dataMapping.demandSelector.label",
                    )}
                  />
                </div>
                <div>
                  <label className="block text-size-base text-default mb-2">
                    {`${translate(
                      "importCustomerPoints.wizard.dataMapping.defaultDemand.label",
                    )} (${translateUnit(customerDemandPerDayUnit)})`}
                  </label>
                  <NumericField
                    label={translate(
                      "importCustomerPoints.wizard.dataMapping.defaultDemand.label",
                    )}
                    displayValue={localizeDecimal(defaultDemand)}
                    onChangeValue={handleDefaultDemandChange}
                    positiveOnly={true}
                    isNullable={false}
                    disabled={!!selectedDemandProperty}
                    styleOptions={{ padding: "md", textSize: "sm" }}
                  />
                  <p className="text-size-small text-subtle mt-1">
                    {translate(
                      "importCustomerPoints.wizard.dataMapping.defaultDemand.description",
                    )}
                  </p>
                </div>
                <div>
                  <label className="block text-size-base text-default mb-2">
                    {`${translate(
                      "importCustomerPoints.wizard.demandOptions.timePattern.title",
                    )} (${translate("optional")})`}
                  </label>
                  <Selector
                    nullable
                    placeholder={constantLabel}
                    clearLabel={constantLabel}
                    options={realPatternOptions}
                    selected={selectedPatternId ?? null}
                    onChange={(value) =>
                      handlePatternChange(value ?? CONSTANT_PATTERN_ID)
                    }
                    ariaLabel={translate(
                      "importCustomerPoints.wizard.demandOptions.timePattern.title",
                    )}
                  />
                  <p className="text-size-small text-subtle mt-1">
                    {translate(
                      "importCustomerPoints.wizard.demandOptions.timePattern.description",
                    )}
                  </p>
                </div>
              </div>
            </div>

            {showLoading && (
              <div>
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <span className="ml-3 text-subtle">
                    {translate(
                      "importCustomerPoints.wizard.dataMapping.loading",
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {showNoDataMessage && (
          <p className="text-subtle">
            {translate(
              "importCustomerPoints.wizard.dataMapping.messages.noValidCustomerPoints",
            )}
          </p>
        )}

        {error && (
          <div className="bg-error-subtle border border-red-200 rounded-md p-3">
            <p className="text-red-700 text-size-base">{error}</p>
          </div>
        )}

        {showDataPreview && (
          <>
            <IssuesSummary issues={parsedDataSummary.issues} />

            <CustomerPointsTable
              customerPoints={parsedDataSummary.validCustomerPoints}
              maxPreviewRows={MAX_PREVIEW_ROWS}
              parsedDataSummary={parsedDataSummary}
              wizardState={wizardState}
            />
          </>
        )}
      </div>

      {renderActions && (
        <WizardActionsComponent
          backAction={{
            onClick: onBack,
            disabled: isLoading,
          }}
          nextAction={{
            onClick: onNext,
            disabled: isNextDisabled,
          }}
        />
      )}
    </>
  );
};
