import { forwardRef, useCallback } from "react";
import { useFormikContext } from "formik";
import { useAtomValue } from "jotai";

import { useTranslate } from "src/hooks/use-translate";
import { TimeField } from "src/components/form/time-field";
import { NumericField } from "src/components/form/numeric-field";
import { Selector } from "src/components/form/selector";
import { simulationSettingsAtom } from "src/state/jotai";
import { hasScenariosAtom } from "src/state/scenarios";

import type { DemandModel } from "src/simulation/simulation-settings";
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
      className="flex-1 min-h-0 overflow-y-auto placemark-scrollbar scroll-shadows pl-4"
    >
      <div className="flex flex-col gap-20 py-2">{children}</div>
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
      <h3 className="text-base font-semibold text-gray-900 dark:text-white pb-3 mb-3">
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
          disabled={!isEPS}
          readonly={readonly}
          onChange={(v) => setFieldValue("duration", v)}
          error={fieldErrors.duration}
        />

        <TimeSetting
          label={translate("simulationSettings.hydraulicTimestep")}
          description={translate("simulationSettings.hydraulicTimestepDesc")}
          value={values.hydraulicTimestep}
          disabled={!isEPS}
          readonly={readonly}
          onChange={(v) => setFieldValue("hydraulicTimestep", v)}
          error={fieldErrors.hydraulicTimestep}
        />

        <TimeSetting
          label={translate("simulationSettings.reportingTimestep")}
          description={translate("simulationSettings.reportingTimestepDesc")}
          value={values.reportTimestep}
          disabled={!isEPS}
          readonly={readonly}
          onChange={(v) => setFieldValue("reportTimestep", v)}
          error={fieldErrors.reportTimestep}
        />

        <TimeSetting
          label={translate("simulationSettings.patternTimestep")}
          description={translate("simulationSettings.patternTimestepDesc")}
          value={values.patternTimestep}
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
      <h3 className="text-base font-semibold text-gray-900 dark:text-white pb-3 mb-3">
        {translate("simulationSettings.demands")}
      </h3>

      <div className="flex flex-col gap-4">
        <div
          data-section-id="demands-calculation"
          className="text-sm font-semibold text-gray-900 dark:text-white mt-2"
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
          className="text-sm font-semibold text-gray-900 dark:text-white mt-6"
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

type FieldError = "required" | "positive" | null;

const TimeSetting = ({
  label,
  description,
  value,
  disabled = false,
  readonly = false,
  onChange,
  error = null,
}: {
  label: string;
  description: string;
  value: number | undefined;
  disabled?: boolean;
  readonly?: boolean;
  onChange: (value: number | undefined) => void;
  error?: FieldError;
}) => {
  const translate = useTranslate();

  const errorMessage =
    error === "required"
      ? translate("simulationSettings.fieldRequired")
      : error === "positive"
        ? translate("simulationSettings.fieldMustBePositive")
        : null;

  return (
    <SettingsRow label={label} description={description}>
      <div className="flex items-center gap-2">
        <div className="w-24">
          <TimeField
            label={label}
            value={value}
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

const SelectorSetting = <T extends string>({
  label,
  description,
  options,
  selected,
  disabled = false,
  onChange,
}: {
  label: string;
  description?: string;
  options: { label: string; value: T }[];
  selected: T;
  disabled?: boolean;
  onChange: (value: T) => void;
}) => (
  <SettingsRow label={label} description={description}>
    <div className="w-56">
      <Selector
        ariaLabel={label}
        options={options}
        selected={selected}
        onChange={onChange}
        disabled={disabled}
        styleOptions={{ border: true, textSize: "text-sm", paddingY: 2 }}
      />
    </div>
  </SettingsRow>
);

const getFieldError = (
  isEPS: boolean,
  value: number | undefined,
): FieldError => {
  if (!isEPS) return null;
  if (value === undefined) return "required";
  if (value === 0) return "positive";
  return null;
};

const getOptionalFieldError = (
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
    qualityTimestep: getOptionalFieldError(isEPS, values.qualityTimestep),
    ruleTimestep: getOptionalFieldError(isEPS, values.ruleTimestep),
  };

  const hasValidationError = Object.values(fieldErrors).some(
    (error) => error !== null,
  );

  return { hasValidationError, fieldErrors };
};
