import { forwardRef, useCallback, useMemo } from "react";
import { useFormikContext } from "formik";
import { useAtomValue } from "jotai";
import clsx from "clsx";

import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { TimeField } from "src/components/form/time-field";
import { NumericField } from "src/components/form/numeric-field";
import { Selector, SelectorOption } from "src/components/form/selector";
import { simulationSettingsAtom } from "src/state/jotai";
import { hasScenariosAtom } from "src/state/scenarios";
import {
  assetsAtom,
  patternsAtom,
  stagingModelAtom,
} from "src/state/hydraulic-model";

import type {
  DemandModel,
  UnbalancedMode,
  QualitySimulationType,
  QualityMassUnit,
  StatusReport,
} from "src/simulation/simulation-settings";
import { chooseUnitSystem } from "src/simulation/build-inp";
import {
  headlossFormulas,
  headlossFormulasFullNames,
} from "src/hydraulic-model/asset-types/pipe";
import { EditableTextField } from "src/components/form/editable-text-field";
import type {
  FormValues,
  SimulationModeOption,
} from "./simulation-settings-dialog";

const ONE_HOUR = 3600;

export const SimulationSettingsContent = forwardRef<
  HTMLDivElement,
  { children: React.ReactNode }
>(function SimulationSettingsContent({ children }, ref) {
  const measureRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
      if (!node) return;
      const updateHeight = () => {
        node.style.setProperty("--scroll-height", `${node.clientHeight}px`);
      };
      updateHeight();
      const observer = new ResizeObserver(updateHeight);
      observer.observe(node);
    },
    [ref],
  );

  return (
    <div
      ref={measureRef}
      className="flex-1 min-h-0 overflow-auto scroll-shadows"
    >
      <div className="flex flex-col gap-10 p-3">{children}</div>
    </div>
  );
});

export const SettingsSection = ({
  sectionId,
  children,
}: {
  sectionId: string;
  children: React.ReactNode;
}) => (
  <div
    data-section-id={sectionId}
    className="last:min-h-[calc(var(--scroll-height)-1rem)]"
  >
    {children}
  </div>
);

export const GeneralSection = () => {
  const translate = useTranslate();
  const readonly = useAtomValue(hasScenariosAtom);
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const { values, setFieldValue } = useFormikContext<FormValues>();

  const flowUnitsDisplay = chooseUnitSystem(hydraulicModel.units);
  const headlossIndex = headlossFormulas.indexOf(
    hydraulicModel.headlossFormula,
  );
  const headlossDisplay =
    headlossIndex >= 0
      ? headlossFormulasFullNames[headlossIndex]
      : hydraulicModel.headlossFormula;

  const statusReportOptions: { label: string; value: StatusReport }[] = [
    { label: translate("simulationSettings.statusReportYes"), value: "YES" },
    { label: translate("simulationSettings.statusReportNo"), value: "NO" },
    { label: translate("simulationSettings.statusReportFull"), value: "FULL" },
  ];

  return (
    <div>
      <h3 className="sticky -top-3 bg-white dark:bg-gray-800 -mt-3 -mx-3 pt-4 px-3 pb-2 z-10 text-base font-semibold text-gray-900 dark:text-white">
        {translate("simulationSettings.general")}
      </h3>

      <div className="flex flex-col gap-4">
        <TextSetting
          label={translate("simulationSettings.flowUnits")}
          description={translate("simulationSettings.flowUnitsDesc")}
          value={flowUnitsDisplay}
          onChange={() => {}}
          disabled
        />

        <TextSetting
          label={translate("simulationSettings.headlossFormula")}
          description={translate("simulationSettings.headlossFormulaDesc")}
          value={headlossDisplay}
          onChange={() => {}}
          disabled
        />

        <SelectorSetting
          label={translate("simulationSettings.statusReport")}
          description={translate("simulationSettings.statusReportDesc")}
          options={statusReportOptions}
          selected={values.statusReport}
          onChange={(v) => setFieldValue("statusReport", v)}
          disabled={readonly}
        />
      </div>
    </div>
  );
};

export const TimesSection = () => {
  const translate = useTranslate();
  const readonly = useAtomValue(hasScenariosAtom);
  const { timing } = useAtomValue(simulationSettingsAtom);
  const { values, setFieldValue } = useFormikContext<FormValues>();
  const { fieldErrors } = useTimeSettingsValidation();

  const isEPS = values.simulationMode === "eps";

  const simulationModeOptions: {
    label: string;
    value: SimulationModeOption;
  }[] = [
    {
      label: translate("simulationSettings.steadyState"),
      value: "steadyState",
    },
    {
      label: translate("simulationSettings.epsExtended"),
      value: "eps",
    },
  ];

  const handleSimulationModeChange = (newValue: SimulationModeOption) => {
    void setFieldValue("simulationMode", newValue);
    if (newValue === "eps") {
      if (!values.duration)
        void setFieldValue("duration", timing.duration || 24 * ONE_HOUR);
      if (!values.hydraulicTimestep)
        void setFieldValue(
          "hydraulicTimestep",
          timing.hydraulicTimestep || ONE_HOUR,
        );
      if (!values.reportTimestep)
        void setFieldValue("reportTimestep", timing.reportTimestep || ONE_HOUR);
      if (!values.patternTimestep)
        void setFieldValue(
          "patternTimestep",
          timing.patternTimestep || ONE_HOUR,
        );
    }
  };

  return (
    <div>
      <h3 className="sticky -top-3 bg-white dark:bg-gray-800 -mt-3 -mx-3 pt-4 px-3 pb-2 z-10 text-base font-semibold text-gray-900 dark:text-white">
        {translate("simulationSettings.times")}
      </h3>

      <div className="flex flex-col gap-4">
        <SelectorSetting
          label={translate("simulationSettings.timeAnalysisMode")}
          options={simulationModeOptions}
          selected={values.simulationMode}
          onChange={handleSimulationModeChange}
          disabled={readonly}
        />

        <TimeSetting
          label={translate("simulationSettings.totalDuration")}
          description={translate("simulationSettings.totalDurationDesc")}
          value={values.duration}
          defaultValue={timing.duration || 24 * ONE_HOUR}
          disabled={!isEPS}
          readonly={readonly}
          onChange={(v) => setFieldValue("duration", v)}
          error={fieldErrors.duration}
        />

        <TimeSetting
          label={translate("simulationSettings.hydraulicTimestep")}
          description={translate("simulationSettings.hydraulicTimestepDesc")}
          value={values.hydraulicTimestep}
          defaultValue={timing.hydraulicTimestep || ONE_HOUR}
          disabled={!isEPS}
          readonly={readonly}
          onChange={(v) => setFieldValue("hydraulicTimestep", v)}
          error={fieldErrors.hydraulicTimestep}
        />

        <TimeSetting
          label={translate("simulationSettings.reportingTimestep")}
          description={translate("simulationSettings.reportingTimestepDesc")}
          value={values.reportTimestep}
          defaultValue={timing.reportTimestep || ONE_HOUR}
          disabled={!isEPS}
          readonly={readonly}
          onChange={(v) => setFieldValue("reportTimestep", v)}
          error={fieldErrors.reportTimestep}
        />

        <TimeSetting
          label={translate("simulationSettings.patternTimestep")}
          description={translate("simulationSettings.patternTimestepDesc")}
          value={values.patternTimestep}
          defaultValue={timing.patternTimestep || ONE_HOUR}
          disabled={!isEPS}
          readonly={readonly}
          onChange={(v) => setFieldValue("patternTimestep", v)}
          error={fieldErrors.patternTimestep}
        />

        <TimeSetting
          label={translate("simulationSettings.qualityTimestep")}
          description={translate("simulationSettings.qualityTimestepDesc")}
          value={values.qualityTimestep}
          disabled={!isEPS}
          readonly={readonly}
          onChange={(v) => setFieldValue("qualityTimestep", v)}
          error={fieldErrors.qualityTimestep}
        />

        <TimeSetting
          label={translate("simulationSettings.ruleTimestep")}
          description={translate("simulationSettings.ruleTimestepDesc")}
          value={values.ruleTimestep}
          disabled={!isEPS}
          readonly={readonly}
          onChange={(v) => setFieldValue("ruleTimestep", v)}
          error={fieldErrors.ruleTimestep}
        />
      </div>
    </div>
  );
};

export const DemandsSection = () => {
  const translate = useTranslate();
  const readonly = useAtomValue(hasScenariosAtom);
  const { values, setFieldValue } = useFormikContext<FormValues>();

  const isPDA = values.demandModel === "PDA";

  const demandModelOptions: { label: string; value: DemandModel }[] = [
    {
      label: translate("simulationSettings.demandModelDDA"),
      value: "DDA",
    },
    {
      label: translate("simulationSettings.demandModelPDA"),
      value: "PDA",
    },
  ];

  return (
    <div>
      <h3 className="sticky -top-3 bg-white dark:bg-gray-800 -mt-3 -mx-3 pt-4 px-3 pb-2 z-10 text-base font-semibold text-gray-900 dark:text-white">
        {translate("simulationSettings.demands")}
      </h3>

      <div className="flex flex-col gap-4">
        <div
          data-section-id="demands-calculation"
          className="sticky top-[2.25rem] z-10 px-3 pb-2 -mx-3 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-900 dark:text-white"
        >
          {translate("simulationSettings.demandsCalculation")}
        </div>

        <ValueSetting
          label={translate("simulationSettings.globalDemandMultiplier")}
          description={translate(
            "simulationSettings.globalDemandMultiplierDesc",
          )}
          value={values.globalDemandMultiplier}
          onChange={(v) => setFieldValue("globalDemandMultiplier", v)}
        />

        <SelectorSetting
          label={translate("simulationSettings.demandModel")}
          description={translate("simulationSettings.demandModelDesc")}
          options={demandModelOptions}
          selected={values.demandModel}
          onChange={(v) => setFieldValue("demandModel", v)}
          disabled={readonly}
        />

        <ValueSetting
          label={translate("simulationSettings.minimumPressure")}
          description={translate("simulationSettings.minimumPressureDesc")}
          value={values.minimumPressure}
          onChange={(v) => setFieldValue("minimumPressure", v)}
          disabled={!isPDA || readonly}
        />

        <ValueSetting
          label={translate("simulationSettings.requiredPressure")}
          description={translate("simulationSettings.requiredPressureDesc")}
          value={values.requiredPressure}
          onChange={(v) => setFieldValue("requiredPressure", v)}
          disabled={!isPDA || readonly}
        />

        <ValueSetting
          label={translate("simulationSettings.pressureExponent")}
          description={translate("simulationSettings.pressureExponentDesc")}
          value={values.pressureExponent}
          onChange={(v) => setFieldValue("pressureExponent", v)}
          disabled={!isPDA || readonly}
        />

        <div
          data-section-id="demands-emitters"
          className="sticky top-[2.25rem] z-10 px-3 pb-2 -mx-3 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-900 dark:text-white"
        >
          {translate("simulationSettings.demandsEmitters")}
        </div>

        <ValueSetting
          label={translate("simulationSettings.emitterExponent")}
          description={translate("simulationSettings.emitterExponentDesc")}
          value={values.emitterExponent}
          onChange={(v) => setFieldValue("emitterExponent", v)}
          disabled={readonly}
        />
      </div>
    </div>
  );
};

export const HydraulicsSection = () => {
  const translate = useTranslate();
  const readonly = useAtomValue(hasScenariosAtom);
  const { values, setFieldValue } = useFormikContext<FormValues>();

  const isStop = values.unbalancedMode === "STOP";

  const unbalancedModeOptions: { label: string; value: UnbalancedMode }[] = [
    {
      label: translate("simulationSettings.unbalancedStop"),
      value: "STOP",
    },
    {
      label: translate("simulationSettings.unbalancedContinue"),
      value: "CONTINUE",
    },
  ];

  return (
    <div>
      <h3 className="sticky -top-3 bg-white dark:bg-gray-800 -mt-3 -mx-3 pt-4 px-3 pb-2 z-10 text-base font-semibold text-gray-900 dark:text-white">
        {translate("simulationSettings.hydraulics")}
      </h3>

      <div className="flex flex-col gap-4">
        <div
          data-section-id="hydraulics-convergence"
          className="sticky top-[2.25rem] z-10 px-3 pb-2 -mx-3 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-900 dark:text-white"
        >
          {translate("simulationSettings.hydraulicsConvergence")}
        </div>

        <ValueSetting
          label={translate("simulationSettings.trials")}
          description={translate("simulationSettings.trialsDesc")}
          value={values.trials}
          onChange={(v) => setFieldValue("trials", v)}
          disabled={readonly}
        />

        <ValueSetting
          label={translate("simulationSettings.accuracy")}
          description={translate("simulationSettings.accuracyDesc")}
          value={values.accuracy}
          onChange={(v) => setFieldValue("accuracy", v)}
          disabled={readonly}
        />

        <SelectorSetting
          label={translate("simulationSettings.unbalancedMode")}
          description={translate("simulationSettings.unbalancedModeDesc")}
          options={unbalancedModeOptions}
          selected={values.unbalancedMode}
          onChange={(v) => setFieldValue("unbalancedMode", v)}
          disabled={readonly}
        />

        <ValueSetting
          label={translate("simulationSettings.unbalancedExtraTrials")}
          description={translate(
            "simulationSettings.unbalancedExtraTrialsDesc",
          )}
          value={values.unbalancedExtraTrials}
          onChange={(v) => setFieldValue("unbalancedExtraTrials", v)}
          disabled={isStop || readonly}
        />

        <ValueSetting
          label={translate("simulationSettings.headError")}
          description={translate("simulationSettings.headErrorDesc")}
          value={values.headError}
          onChange={(v) => setFieldValue("headError", v)}
          disabled={readonly}
        />

        <ValueSetting
          label={translate("simulationSettings.flowChange")}
          description={translate("simulationSettings.flowChangeDesc")}
          value={values.flowChange}
          onChange={(v) => setFieldValue("flowChange", v)}
          disabled={readonly}
        />

        <div
          data-section-id="hydraulics-solver"
          className="sticky top-[2.25rem] z-10 px-3 pb-2 -mx-3 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-900 dark:text-white"
        >
          {translate("simulationSettings.hydraulicsSolver")}
        </div>

        <ValueSetting
          label={translate("simulationSettings.checkFreq")}
          description={translate("simulationSettings.checkFreqDesc")}
          value={values.checkFreq}
          onChange={(v) => setFieldValue("checkFreq", v)}
          disabled={readonly}
        />

        <ValueSetting
          label={translate("simulationSettings.maxCheck")}
          description={translate("simulationSettings.maxCheckDesc")}
          value={values.maxCheck}
          onChange={(v) => setFieldValue("maxCheck", v)}
          disabled={readonly}
        />

        <ValueSetting
          label={translate("simulationSettings.dampLimit")}
          description={translate("simulationSettings.dampLimitDesc")}
          value={values.dampLimit}
          onChange={(v) => setFieldValue("dampLimit", v)}
          disabled={readonly}
        />

        <div
          data-section-id="hydraulics-fluid"
          className="sticky top-[2.25rem] z-10 px-3 pb-2 -mx-3 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-900 dark:text-white"
        >
          {translate("simulationSettings.hydraulicsFluid")}
        </div>

        <ValueSetting
          label={translate("simulationSettings.viscosity")}
          description={translate("simulationSettings.viscosityDesc")}
          value={values.viscosity}
          onChange={(v) => setFieldValue("viscosity", v)}
          disabled={readonly}
        />

        <ValueSetting
          label={translate("simulationSettings.specificGravity")}
          description={translate("simulationSettings.specificGravityDesc")}
          value={values.specificGravity}
          onChange={(v) => setFieldValue("specificGravity", v)}
          disabled={readonly}
        />
      </div>
    </div>
  );
};

export const WaterQualitySection = () => {
  const translate = useTranslate();
  const isWaterQualityOn = useFeatureFlag("FLAG_WATER_QUALITY");
  const readonly = useAtomValue(hasScenariosAtom) || !isWaterQualityOn;
  const assets = useAtomValue(assetsAtom);
  const { values, setFieldValue } = useFormikContext<FormValues>();
  const isNone = values.qualitySimulationType === "NONE";
  const isChemical = values.qualitySimulationType === "CHEMICAL";
  const isTrace = values.qualitySimulationType === "TRACE";

  const traceNodeLabel =
    values.qualityTraceNodeId !== null
      ? (assets.get(values.qualityTraceNodeId)?.label ?? "")
      : "";

  const qualityTypeOptions: {
    label: string;
    value: QualitySimulationType;
  }[] = [
    {
      label: translate("simulationSettings.qualityNone"),
      value: "NONE",
    },
    {
      label: translate("simulationSettings.qualityChemical"),
      value: "CHEMICAL",
    },
    {
      label: translate("simulationSettings.qualityAge"),
      value: "AGE",
    },
    {
      label: translate("simulationSettings.qualityTrace"),
      value: "TRACE",
    },
  ];

  const massUnitOptions: { label: string; value: QualityMassUnit }[] = [
    { label: "mg/L", value: "mg/L" },
    { label: "ug/L", value: "ug/L" },
  ];

  return (
    <div>
      <h3 className="sticky -top-3 bg-white dark:bg-gray-800 -mt-3 -mx-3 pt-4 px-3 pb-2 z-10 text-base font-semibold text-gray-900 dark:text-white">
        {translate("simulationSettings.waterQuality")}
      </h3>

      <div className="flex flex-col gap-4">
        <div
          data-section-id="waterQuality-analysis"
          className="sticky top-[2.25rem] z-10 px-3 pb-2 -mx-3 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-900 dark:text-white"
        >
          {translate("simulationSettings.waterQualityAnalysis")}
        </div>

        <SelectorSetting
          label={translate("simulationSettings.qualitySimulationType")}
          description={translate(
            "simulationSettings.qualitySimulationTypeDesc",
          )}
          options={qualityTypeOptions}
          selected={values.qualitySimulationType}
          onChange={(v) => setFieldValue("qualitySimulationType", v)}
          disabled={readonly}
        />

        <TextSetting
          label={translate("simulationSettings.qualityChemicalName")}
          description={translate("simulationSettings.qualityChemicalNameDesc")}
          value={values.qualityChemicalName}
          onChange={(v) => {
            void setFieldValue("qualityChemicalName", v);
          }}
          disabled={!isChemical || readonly}
        />

        <SelectorSetting
          label={translate("simulationSettings.qualityMassUnit")}
          description={translate("simulationSettings.qualityMassUnitDesc")}
          options={massUnitOptions}
          selected={values.qualityMassUnit}
          onChange={(v) => setFieldValue("qualityMassUnit", v)}
          disabled={!isChemical || readonly}
        />

        <TextSetting
          label={translate("simulationSettings.qualityTraceNode")}
          description={translate("simulationSettings.qualityTraceNodeDesc")}
          value={traceNodeLabel}
          onChange={(label) => {
            if (!label) {
              void setFieldValue("qualityTraceNodeId", null);
              return;
            }
            for (const asset of assets.values()) {
              if (asset.isNode && asset.label === label) {
                void setFieldValue("qualityTraceNodeId", asset.id);
                return;
              }
            }
            void setFieldValue("qualityTraceNodeId", null);
          }}
          disabled={!isTrace || readonly}
        />

        <ValueSetting
          label={translate("simulationSettings.tolerance")}
          description={translate("simulationSettings.toleranceDesc")}
          value={values.tolerance}
          onChange={(v) => setFieldValue("tolerance", v)}
          disabled={isNone || readonly}
        />

        <div
          data-section-id="waterQuality-reactions"
          className="sticky top-[2.25rem] z-10 px-3 pb-2 -mx-3 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-900 dark:text-white"
        >
          {translate("simulationSettings.waterQualityReactions")}
        </div>

        <ValueSetting
          label={translate("simulationSettings.reactionBulkOrder")}
          description={translate("simulationSettings.reactionBulkOrderDesc")}
          value={values.reactionBulkOrder}
          onChange={(v) => setFieldValue("reactionBulkOrder", v)}
          disabled={!isChemical || readonly}
        />

        <ValueSetting
          label={translate("simulationSettings.reactionWallOrder")}
          description={translate("simulationSettings.reactionWallOrderDesc")}
          value={values.reactionWallOrder}
          onChange={(v) => setFieldValue("reactionWallOrder", v)}
          disabled={!isChemical || readonly}
        />

        <ValueSetting
          label={translate("simulationSettings.reactionTankOrder")}
          description={translate("simulationSettings.reactionTankOrderDesc")}
          value={values.reactionTankOrder}
          onChange={(v) => setFieldValue("reactionTankOrder", v)}
          disabled={!isChemical || readonly}
        />

        <ValueSetting
          label={translate("simulationSettings.reactionGlobalBulk")}
          description={translate("simulationSettings.reactionGlobalBulkDesc")}
          value={values.reactionGlobalBulk}
          onChange={(v) => setFieldValue("reactionGlobalBulk", v)}
          disabled={!isChemical || readonly}
        />

        <ValueSetting
          label={translate("simulationSettings.reactionGlobalWall")}
          description={translate("simulationSettings.reactionGlobalWallDesc")}
          value={values.reactionGlobalWall}
          onChange={(v) => setFieldValue("reactionGlobalWall", v)}
          disabled={!isChemical || readonly}
        />

        <div
          data-section-id="waterQuality-wall"
          className="sticky top-[2.25rem] z-10 px-3 pb-2 -mx-3 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-900 dark:text-white"
        >
          {translate("simulationSettings.waterQualityWall")}
        </div>

        <ValueSetting
          label={translate("simulationSettings.reactionLimitingPotential")}
          description={translate(
            "simulationSettings.reactionLimitingPotentialDesc",
          )}
          value={values.reactionLimitingPotential}
          onChange={(v) => setFieldValue("reactionLimitingPotential", v)}
          disabled={!isChemical || readonly}
        />

        <ValueSetting
          label={translate("simulationSettings.reactionRoughnessCorrelation")}
          description={translate(
            "simulationSettings.reactionRoughnessCorrelationDesc",
          )}
          value={values.reactionRoughnessCorrelation}
          onChange={(v) => setFieldValue("reactionRoughnessCorrelation", v)}
          disabled={!isChemical || readonly}
        />

        <ValueSetting
          label={translate("simulationSettings.diffusivity")}
          description={translate("simulationSettings.diffusivityDesc")}
          value={values.diffusivity}
          onChange={(v) => setFieldValue("diffusivity", v)}
          disabled={!isChemical || readonly}
        />
      </div>
    </div>
  );
};

export const EnergySection = () => {
  const translate = useTranslate();
  const isEnergyOn = useFeatureFlag("FLAG_ENERGY");
  const readonly = useAtomValue(hasScenariosAtom) || !isEnergyOn;
  const patterns = useAtomValue(patternsAtom);
  const { values, setFieldValue } = useFormikContext<FormValues>();

  const reportEnergyOptions: { label: string; value: "YES" | "NO" }[] = [
    { label: translate("simulationSettings.reportEnergyYes"), value: "YES" },
    { label: translate("simulationSettings.reportEnergyNo"), value: "NO" },
  ];

  const EMPTY_PATTERN_ID = 0;

  const energyPricePatternOptions = useMemo(() => {
    const patternGroup: SelectorOption<number>[] = [];
    for (const [, pattern] of patterns) {
      if (pattern.type === "energyPrice") {
        patternGroup.push({ label: pattern.label, value: pattern.id });
      }
    }

    const constantGroup: SelectorOption<number>[] = [
      {
        label:
          patternGroup.length === 0
            ? translate("simulationSettings.noPatternsYet")
            : translate("constant"),
        value: EMPTY_PATTERN_ID,
      },
    ];

    return patternGroup.length ? [...constantGroup, ...patternGroup] : [];
  }, [patterns, translate]);

  return (
    <div>
      <h3 className="sticky -top-3 bg-white dark:bg-gray-800 -mt-3 -mx-3 pt-4 px-3 pb-2 z-10 text-base font-semibold text-gray-900 dark:text-white">
        {translate("simulationSettings.energy")}
      </h3>

      <div className="flex flex-col gap-4">
        <SelectorSetting
          label={translate("simulationSettings.reportEnergy")}
          description={translate("simulationSettings.reportEnergyDesc")}
          options={reportEnergyOptions}
          selected={values.reportEnergy ? "YES" : "NO"}
          onChange={(v) => setFieldValue("reportEnergy", v === "YES")}
          disabled={readonly}
        />

        <ValueSetting
          label={translate("simulationSettings.energyGlobalEfficiency")}
          description={translate(
            "simulationSettings.energyGlobalEfficiencyDesc",
          )}
          value={values.energyGlobalEfficiency}
          onChange={(v) => setFieldValue("energyGlobalEfficiency", v)}
          disabled={readonly}
        />

        <ValueSetting
          label={translate("simulationSettings.energyGlobalPrice")}
          description={translate("simulationSettings.energyGlobalPriceDesc")}
          value={values.energyGlobalPrice}
          onChange={(v) => setFieldValue("energyGlobalPrice", v)}
          disabled={readonly}
        />

        <SelectorSetting
          label={translate("simulationSettings.energyGlobalPattern")}
          description={translate("simulationSettings.energyGlobalPatternDesc")}
          options={energyPricePatternOptions}
          selected={values.energyGlobalPatternId}
          nullable
          placeholder={
            energyPricePatternOptions.length === 0
              ? translate("simulationSettings.noPatternsYet")
              : translate("constant")
          }
          listClassName="first:italic"
          onChange={(v) =>
            setFieldValue(
              "energyGlobalPatternId",
              v === EMPTY_PATTERN_ID ? null : v,
            )
          }
          disabled={readonly || energyPricePatternOptions.length === 0}
        />

        <ValueSetting
          label={translate("simulationSettings.energyDemandCharge")}
          description={translate("simulationSettings.energyDemandChargeDesc")}
          value={values.energyDemandCharge}
          onChange={(v) => setFieldValue("energyDemandCharge", v)}
          disabled={readonly}
        />
      </div>
    </div>
  );
};

export const SettingsRow = ({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-1">
    <span className="text-sm text-gray-700 dark:text-gray-200">{label}</span>
    {description && (
      <span className="text-xs text-gray-400 dark:text-gray-500">
        {description}
      </span>
    )}
    {children}
  </div>
);

type FieldError = "positive" | null;

const TimeSetting = ({
  label,
  description,
  value,
  defaultValue,
  disabled = false,
  readonly = false,
  onChange,
  error = null,
}: {
  label: string;
  description: string;
  value: number | undefined;
  defaultValue?: number;
  disabled?: boolean;
  readonly?: boolean;
  onChange: (value: number | undefined) => void;
  error?: FieldError;
}) => {
  const translate = useTranslate();

  const errorMessage =
    error === "positive"
      ? translate("simulationSettings.fieldMustBePositive")
      : null;

  return (
    <SettingsRow label={label} description={description}>
      <div className="flex items-center gap-2">
        <div className="w-24">
          <TimeField
            label={label}
            value={value}
            defaultValue={defaultValue}
            onChangeValue={onChange}
            hasError={error !== null}
            disabled={disabled}
            readonly={readonly}
          />
        </div>
        {errorMessage && (
          <span className="text-xs font-semibold text-orange-800">
            {errorMessage}
          </span>
        )}
      </div>
    </SettingsRow>
  );
};

const ValueSetting = ({
  label,
  description,
  value,
  disabled = false,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) => (
  <SettingsRow label={label} description={description}>
    <div className="w-24">
      <NumericField
        label={label}
        displayValue={String(value)}
        onChangeValue={onChange}
        isNullable={false}
        disabled={disabled}
        styleOptions={{ textSize: "xs" }}
      />
    </div>
  </SettingsRow>
);

type SelectorSettingPropsBase<T extends string | number> = {
  label: string;
  description?: string;
  options: SelectorOption<T>[] | SelectorOption<T>[][];
  listClassName?: string;
  disabled?: boolean;
  stickyFirstGroup?: boolean;
};

type SelectorSettingPropsNonNullable<T extends string | number> =
  SelectorSettingPropsBase<T> & {
    selected: T;
    nullable?: false;
    placeholder?: never;
    onChange: (value: T) => void;
  };

type SelectorSettingPropsNullable<T extends string | number> =
  SelectorSettingPropsBase<T> & {
    selected: T | null;
    nullable: true;
    placeholder: string;
    onChange: (value: T | null) => void;
  };

type SelectorSettingProps<T extends string | number> =
  | SelectorSettingPropsNonNullable<T>
  | SelectorSettingPropsNullable<T>;

const SelectorSetting = <T extends string | number>({
  label,
  description,
  options,
  selected,
  nullable = false,
  placeholder,
  disabled = false,
  stickyFirstGroup,
  listClassName,
  onChange,
}: SelectorSettingProps<T>) => (
  <SettingsRow label={label} description={description}>
    <div className="w-56">
      <Selector
        ariaLabel={label}
        options={options}
        selected={selected}
        onChange={(v: T | null) => (onChange as (value: T | null) => void)(v)}
        disabled={disabled}
        nullable={nullable as true}
        placeholder={placeholder as string}
        stickyFirstGroup={stickyFirstGroup}
        listClassName={listClassName}
        styleOptions={{ border: true, textSize: "text-sm", paddingY: 2 }}
      />
    </div>
  </SettingsRow>
);

const TextSetting = ({
  label,
  description,
  value,
  disabled = false,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) => (
  <SettingsRow label={label} description={description}>
    <div
      className={clsx(
        "w-56",
        disabled &&
          "[&>input]:border-gray-300 [&>input]:bg-gray-100 [&>input]:dark:bg-gray-800",
      )}
    >
      <EditableTextField
        label={label}
        value={value}
        onChangeValue={(v) => {
          onChange(v);
          return false;
        }}
        disabled={disabled}
        styleOptions={{ textSize: "xs", border: "sm" }}
      />
    </div>
  </SettingsRow>
);

const getFieldError = (
  isEPS: boolean,
  value: number | undefined,
): FieldError => {
  if (!isEPS) return null;
  if (value === 0) return "positive";
  return null;
};

export const useTimeSettingsValidation = () => {
  const { values } = useFormikContext<FormValues>();

  const isEPS = values.simulationMode === "eps";

  const fieldErrors = {
    duration: getFieldError(isEPS, values.duration),
    hydraulicTimestep: getFieldError(isEPS, values.hydraulicTimestep),
    reportTimestep: getFieldError(isEPS, values.reportTimestep),
    patternTimestep: getFieldError(isEPS, values.patternTimestep),
    qualityTimestep: getFieldError(isEPS, values.qualityTimestep),
    ruleTimestep: getFieldError(isEPS, values.ruleTimestep),
  };

  const hasValidationError = Object.values(fieldErrors).some(
    (error) => error !== null,
  );

  return { hasValidationError, fieldErrors };
};
