import React, { useCallback, useEffect, useMemo, useState } from "react";
import { isZeroOrGreater } from "src/components/form/numeric-input-utils";
import { Feature } from "geojson";
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
import {
  CustomerPointsIssuesAccumulator,
  CustomerPointsParserIssues,
} from "src/import/customer-points/parse-customer-points-issues";
import { Demand } from "@epanet-js/hydraulic-model";
import { localizeDecimal } from "src/infra/i18n/numbers";
import {
  WizardState,
  WizardActions,
  ParsedDataSummary,
  InputData,
} from "./types";
import { UnitsSpec } from "src/lib/project-settings/quantities-spec";
import { WizardActions as WizardActionsComponent } from "src/components/wizard";
import { convertTo } from "@epanet-js/quantity";
import { ChevronDownIcon, ChevronRightIcon } from "src/icons";
import { Selector } from "@epanet-js/ui-kit";
import { NumericField } from "src/components/form/numeric-field";
const CONSTANT_PATTERN_ID = 0;

export const DataMappingStep: React.FC<{
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
      if (!inputData) return;
      setParsedDataSummary(null);
      parseInputDataToCustomerPoints(
        inputData,
        selectedDemandProperty,
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
              <div className="@container space-y-4">
                <div className="@lg:grid @lg:grid-cols-3 @lg:gap-x-4">
                  <div className="space-y-2">
                    <label className="block text-size-base text-default">
                      {translate(
                        "importCustomerPoints.wizard.dataMapping.labelSelector.label",
                      )}
                    </label>
                    <Selector
                      nullable={true}
                      placeholder={translate(
                        "importCustomerPoints.wizard.dataMapping.labelSelector.autoGenerate",
                      )}
                      options={Array.from(inputData.properties).map((prop) => ({
                        label: prop,
                        value: prop,
                      }))}
                      selected={selectedLabelProperty || null}
                      clearLabel={translate(
                        "importCustomerPoints.wizard.dataMapping.labelSelector.autoGenerate",
                      )}
                      onChange={(value) =>
                        handleLabelPropertyChange(value ?? "")
                      }
                      ariaLabel={translate(
                        "importCustomerPoints.wizard.dataMapping.labelSelector.label",
                      )}
                    />
                    <p className="text-size-small text-subtle">
                      {translate(
                        "importCustomerPoints.wizard.dataMapping.labelSelector.description",
                        String(MAX_CUSTOMER_POINT_LABEL_LENGTH),
                      )}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 @lg:grid @lg:gap-x-4 @lg:gap-y-2 @lg:space-y-0 @lg:grid-cols-3 @lg:grid-rows-[repeat(3,auto)]">
                  <div className="space-y-2 @lg:space-y-0 @lg:grid @lg:grid-rows-subgrid @lg:row-span-3 @lg:gap-y-2">
                    <label className="block text-size-base text-default">
                      {translate(
                        "importCustomerPoints.wizard.dataMapping.demandSelector.label",
                      )}
                    </label>
                    <Selector
                      nullable={true}
                      placeholder={translate(
                        "importCustomerPoints.wizard.dataMapping.demandSelector.useDefault",
                      )}
                      options={Array.from(inputData.properties).map((prop) => ({
                        label: prop,
                        value: prop,
                      }))}
                      selected={selectedDemandProperty}
                      clearLabel={translate(
                        "importCustomerPoints.wizard.dataMapping.demandSelector.useDefault",
                      )}
                      onChange={(value) =>
                        handleDemandPropertyChange(value ?? null)
                      }
                      ariaLabel={translate(
                        "importCustomerPoints.wizard.dataMapping.demandSelector.label",
                      )}
                    />
                  </div>
                  <div className="space-y-2 @lg:space-y-0 @lg:grid @lg:grid-rows-subgrid @lg:row-span-3 @lg:gap-y-2">
                    <label className="block text-size-base text-default">
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
                      validate={isZeroOrGreater}
                      styleOptions={{ padding: "md", textSize: "sm" }}
                    />
                    <p className="text-size-small text-subtle">
                      {translate(
                        "importCustomerPoints.wizard.dataMapping.defaultDemand.description",
                      )}
                    </p>
                  </div>
                  <div className="space-y-2 @lg:space-y-0 @lg:grid @lg:grid-rows-subgrid @lg:row-span-3 @lg:gap-y-2">
                    <label className="block text-size-base text-default">
                      {translate(
                        "importCustomerPoints.wizard.demandOptions.timePattern.title",
                      )}
                    </label>
                    <Selector
                      nullable
                      placeholder={constantLabel}
                      clearLabel={constantLabel}
                      options={realPatternOptions}
                      selected={selectedPatternId ?? null}
                      disabled={patterns.size === 0}
                      onChange={(value) =>
                        handlePatternChange(value ?? CONSTANT_PATTERN_ID)
                      }
                      ariaLabel={translate(
                        "importCustomerPoints.wizard.demandOptions.timePattern.title",
                      )}
                    />
                    <p className="text-size-small text-subtle">
                      {translate(
                        "importCustomerPoints.wizard.demandOptions.timePattern.description",
                      )}
                    </p>
                  </div>
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

type CustomerPointsTableProps = {
  customerPoints: CustomerPoint[];
  maxPreviewRows: number;
  parsedDataSummary: ParsedDataSummary;
  wizardState: WizardState & WizardActions & { units: UnitsSpec };
};

export const CustomerPointsTable: React.FC<CustomerPointsTableProps> = ({
  customerPoints,
  maxPreviewRows,
  parsedDataSummary,
  wizardState,
}) => {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const customerDemandUnit = wizardState.units.customerDemand;
  const customerDemandPerDayUnit = wizardState.units.customerDemandPerDay;
  const validCount = customerPoints.length;
  const validPreview = customerPoints.slice(0, maxPreviewRows);
  const validHasMore = validCount > maxPreviewRows;

  if (validCount === 0) {
    return (
      <p className="text-subtle text-size-base">
        {translate(
          "importCustomerPoints.wizard.dataMapping.messages.noValidCustomerPoints",
        )}
      </p>
    );
  }

  return (
    <div className="mt-6">
      <h4 className="text-md font-medium text-default">
        {translate(
          "importCustomerPoints.wizard.dataMapping.table.title",
          localizeDecimal(validCount),
        )}
      </h4>
      <div className="overflow-x-auto mt-2 border rounded-lg">
        <table className="min-w-full text-size-base">
          <thead className="bg-panel sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left text-size-small font-medium text-subtle tracking-wider border-b">
                {translate(
                  "importCustomerPoints.wizard.dataMapping.table.label",
                )}
              </th>
              <th className="px-3 py-2 text-left text-size-small font-medium text-subtle tracking-wider border-b">
                {translate(
                  "importCustomerPoints.wizard.dataMapping.table.latitude",
                )}
              </th>
              <th className="px-3 py-2 text-left text-size-small font-medium text-subtle tracking-wider border-b">
                {translate(
                  "importCustomerPoints.wizard.dataMapping.table.longitude",
                )}
              </th>
              <th className="px-3 py-2 text-left text-size-small font-medium text-subtle tracking-wider border-b">
                {`${translate(
                  "importCustomerPoints.wizard.dataMapping.table.demand",
                )} (${translateUnit(customerDemandPerDayUnit)})`}
              </th>
            </tr>
          </thead>
          <tbody>
            {validPreview.map((point, index) => (
              <tr
                key={point.id}
                className={index % 2 === 0 ? "bg-base" : "bg-panel"}
              >
                <td className="px-3 py-2 border-b">
                  <div className="truncate" title={point.label}>
                    {point.label}
                  </div>
                </td>
                <td className="px-3 py-2 border-b">
                  {localizeDecimal(point.coordinates[1], { decimals: 6 })}
                </td>
                <td className="px-3 py-2 border-b">
                  {localizeDecimal(point.coordinates[0], { decimals: 6 })}
                </td>
                <td className="px-3 py-2 border-b">
                  {localizeDecimal(
                    convertTo(
                      {
                        value:
                          parsedDataSummary.customerPointDemands.get(
                            point.id,
                          )?.[0]?.baseDemand ?? 0,
                        unit: customerDemandUnit,
                      },
                      customerDemandPerDayUnit,
                    ),
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {validHasMore && (
          <p className="text-size-base text-subtle text-center py-2">
            {translate(
              "importCustomerPoints.wizard.dataMapping.messages.andXMore",
              localizeDecimal(validCount - maxPreviewRows, { decimals: 0 }),
            )}
          </p>
        )}
      </div>
    </div>
  );
};

type IssuesSummaryProps = {
  issues: CustomerPointsParserIssues | null;
};

export const IssuesSummary: React.FC<IssuesSummaryProps> = ({ issues }) => {
  const translate = useTranslate();
  const fallbackFeatures = issues?.skippedInvalidDemands ?? [];
  const totalIssueCount =
    (issues?.skippedNonPointFeatures?.length || 0) +
    (issues?.skippedInvalidCoordinates?.length || 0) +
    (issues?.skippedMissingCoordinates?.length || 0) +
    (issues?.skippedInvalidProjection?.length || 0) +
    (issues?.skippedCreationFailures?.length || 0) +
    fallbackFeatures.length;

  if (totalIssueCount === 0) return null;

  return (
    <div className="space-y-2 mt-6">
      <h2 className="text-md font-medium text-default">
        {translate(
          "importCustomerPoints.wizard.dataMapping.issues.title",
          localizeDecimal(totalIssueCount),
        )}
      </h2>
      <div className="space-y-4">
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-size-base text-yellow-800">
            {translate(
              "importCustomerPoints.wizard.dataMapping.messages.skippedRowsWarning",
            )}
          </p>
        </div>
        {issues?.skippedNonPointFeatures && (
          <IssueSection
            title={translate(
              "importCustomerPoints.wizard.dataMapping.issues.nonPointGeometries",
              issues.skippedNonPointFeatures.length.toString(),
            )}
            features={issues.skippedNonPointFeatures}
          />
        )}
        {issues?.skippedInvalidCoordinates && (
          <IssueSection
            title={translate(
              "importCustomerPoints.wizard.dataMapping.issues.invalidCoordinates",
              issues.skippedInvalidCoordinates.length.toString(),
            )}
            features={issues.skippedInvalidCoordinates}
          />
        )}
        {issues?.skippedMissingCoordinates && (
          <IssueSection
            title={translate(
              "importCustomerPoints.wizard.dataMapping.issues.missingCoordinates",
              issues.skippedMissingCoordinates.length.toString(),
            )}
            features={issues.skippedMissingCoordinates}
          />
        )}
        {issues?.skippedInvalidProjection && (
          <IssueSection
            title={translate(
              "importCustomerPoints.wizard.dataMapping.issues.invalidProjection",
              issues.skippedInvalidProjection.length.toString(),
            )}
            features={issues.skippedInvalidProjection}
          />
        )}
        {fallbackFeatures.length > 0 && (
          <IssueSection
            title={translate(
              "importCustomerPoints.wizard.dataMapping.issues.defaultedDemands",
              fallbackFeatures.length.toString(),
            )}
            features={fallbackFeatures}
          />
        )}
        {issues?.skippedCreationFailures && (
          <IssueSection
            title={translate(
              "importCustomerPoints.wizard.dataMapping.issues.creationFailures",
              issues.skippedCreationFailures.length.toString(),
            )}
            features={issues.skippedCreationFailures}
          />
        )}
      </div>
    </div>
  );
};

type IssueSectionProps = {
  title: string;
  features: Feature[];
};

export const IssueSection: React.FC<IssueSectionProps> = ({
  title,
  features,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const translate = useTranslate();

  return (
    <div className="border rounded-md">
      <button
        className="w-full px-3 py-2 text-left text-size-base text-default hover:bg-panel flex items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span>{title}</span>
        <span className="text-size-base text-subtle">
          {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
        </span>
      </button>
      {isExpanded && (
        <div className="border-t p-3 bg-panel">
          <div className="space-y-2">
            {features.slice(0, 3).map((feature, index) => (
              <div
                key={index}
                className="text-size-small font-mono bg-base p-2 rounded-sm border text-default"
              >
                {JSON.stringify(feature)}
              </div>
            ))}
            {features.length > 3 && (
              <p className="text-size-small text-subtle text-center pt-2">
                {translate(
                  "importCustomerPoints.wizard.dataMapping.messages.andXMoreIssues",
                  (features.length - 3).toString(),
                )}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
