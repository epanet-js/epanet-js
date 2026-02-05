import { useAtomValue } from "jotai";
import { useCallback } from "react";

import { DialogContainer, DialogHeader, useDialogState } from "../dialog";
import { useTranslate } from "src/hooks/use-translate";
import { Form, Formik, useFormikContext } from "formik";
import { NumericField } from "../form/numeric-field";
import { TimeField } from "../form/time-field";
import { stagingModelAtom } from "src/state/jotai";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { SimpleDialogActions } from "src/components/dialog";
import { usePersistence } from "src/lib/persistence";
import { Section } from "../form/fields";
import { useUserTracking } from "src/infra/user-tracking";
import { SettingsIcon } from "src/icons";
import { Selector } from "../form/selector";
import { changeDemandSettings } from "src/hydraulic-model/model-operations/change-demand-settings";
import { changeEPSTiming } from "src/hydraulic-model/model-operations/change-eps-timing";
import { formatSecondsToDisplay } from "../form/time-field";
import { worktreeAtom } from "src/state/scenarios";
import { isMainLocked } from "src/lib/worktree";

type SimulationModeOption = "steadyState" | "eps";

type FormValues = {
  demandMultiplier: number;
  simulationMode: SimulationModeOption;
  duration: number | undefined;
  hydraulicTimestep: number | undefined;
  reportTimestep: number | undefined;
  patternTimestep: number | undefined;
};

export const SimulationSettingsDialog = () => {
  const translate = useTranslate();
  const { closeDialog } = useDialogState();

  const hydraulicModel = useAtomValue(stagingModelAtom);
  const rep = usePersistence();
  const transact = rep.useTransact();
  const userTracking = useUserTracking();

  const handleSubmit = useCallback(
    (values: FormValues) => {
      if (values.demandMultiplier !== hydraulicModel.demands.multiplier) {
        userTracking.capture({
          name: "simulationSetting.changed",
          settingName: "demandMultiplier",
          newValue: values.demandMultiplier,
          oldValue: hydraulicModel.demands.multiplier,
        });

        const demandMoment = changeDemandSettings(hydraulicModel, {
          demandMultiplier: values.demandMultiplier,
        });
        transact(demandMoment);
      }

      const newDuration =
        values.simulationMode === "steadyState" ? 0 : values.duration;
      const hasTimingChanges =
        newDuration !== hydraulicModel.epsTiming.duration ||
        values.hydraulicTimestep !==
          hydraulicModel.epsTiming.hydraulicTimestep ||
        values.reportTimestep !== hydraulicModel.epsTiming.reportTimestep ||
        values.patternTimestep !== hydraulicModel.epsTiming.patternTimestep;

      if (hasTimingChanges) {
        const timingMoment = changeEPSTiming(hydraulicModel, {
          duration: newDuration,
          hydraulicTimestep: values.hydraulicTimestep,
          reportTimestep: values.reportTimestep,
          patternTimestep: values.patternTimestep,
        });
        transact(timingMoment);
      }

      closeDialog();
    },
    [hydraulicModel, transact, closeDialog, userTracking],
  );

  const initialValues: FormValues = {
    demandMultiplier: hydraulicModel.demands.multiplier,
    simulationMode:
      (hydraulicModel.epsTiming.duration ?? 0) > 0 ? "eps" : "steadyState",
    duration: hydraulicModel.epsTiming.duration,
    hydraulicTimestep: hydraulicModel.epsTiming.hydraulicTimestep,
    reportTimestep: hydraulicModel.epsTiming.reportTimestep,
    patternTimestep: hydraulicModel.epsTiming.patternTimestep,
  };

  return (
    <DialogContainer size="sm">
      <DialogHeader
        title={translate("simulationSettings.title")}
        titleIcon={SettingsIcon}
      />
      <Formik onSubmit={handleSubmit} initialValues={initialValues}>
        <SimulationSettingsForm onClose={closeDialog} />
      </Formik>
    </DialogContainer>
  );
};

const SimulationSettingsForm = ({ onClose }: { onClose: () => void }) => {
  const translate = useTranslate();
  const worktree = useAtomValue(worktreeAtom);
  const hasScenarios = isMainLocked(worktree);

  const { hasMissingValues, hasZeroValues } = useTimeSettingsValidation();

  const hasValidationError = hasMissingValues || hasZeroValues;

  return (
    <Form>
      <div className="flex flex-wrap justify-between gap-2">
        <DemandSettings />
        <TimesSettings readonly={hasScenarios} />
      </div>
      <SimpleDialogActions
        onClose={onClose}
        action={translate("simulationSettings.save")}
        isDisabled={hasValidationError}
      />
    </Form>
  );
};

const useTimeSettingsValidation = () => {
  const { values } = useFormikContext<FormValues>();

  const isEPS = values.simulationMode === "eps";

  const fieldErrors = {
    duration: isEPS && (values.duration === undefined || values.duration === 0),
    hydraulicTimestep:
      isEPS &&
      (values.hydraulicTimestep === undefined ||
        values.hydraulicTimestep === 0),
    reportTimestep:
      isEPS &&
      (values.reportTimestep === undefined || values.reportTimestep === 0),
    patternTimestep:
      isEPS &&
      (values.patternTimestep === undefined || values.patternTimestep === 0),
  };

  const hasMissingValues =
    isEPS &&
    (values.duration === undefined ||
      values.hydraulicTimestep === undefined ||
      values.reportTimestep === undefined ||
      values.patternTimestep === undefined);
  const hasZeroValues =
    isEPS &&
    (values.duration === 0 ||
      values.hydraulicTimestep === 0 ||
      values.reportTimestep === 0 ||
      values.patternTimestep === 0);

  return { hasMissingValues, hasZeroValues, fieldErrors };
};

const DemandSettings = () => {
  const translate = useTranslate();
  const { values, setFieldValue } = useFormikContext<FormValues>();

  return (
    <Section title={translate("simulationSettings.demand")}>
      <SettingsGrid>
        <SettingsLabel>
          {translate("simulationSettings.demandMultiplier")}
        </SettingsLabel>
        <SettingsInput>
          <NumericField
            label={translate("simulationSettings.demandMultiplier")}
            displayValue={localizeDecimal(values.demandMultiplier)}
            positiveOnly={true}
            isNullable={false}
            onChangeValue={(newValue) =>
              setFieldValue("demandMultiplier", newValue)
            }
          />
        </SettingsInput>
      </SettingsGrid>
    </Section>
  );
};

const ONE_HOUR = 3600;

const TimesSettings = ({ readonly }: { readonly: boolean }) => {
  const translate = useTranslate();
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const { values, setFieldValue } = useFormikContext<FormValues>();
  const { hasMissingValues, hasZeroValues, fieldErrors } =
    useTimeSettingsValidation();

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
        void setFieldValue(
          "duration",
          hydraulicModel.epsTiming.duration || 24 * ONE_HOUR,
        );
      if (!values.hydraulicTimestep)
        void setFieldValue(
          "hydraulicTimestep",
          hydraulicModel.epsTiming.hydraulicTimestep || ONE_HOUR,
        );
      if (!values.reportTimestep)
        void setFieldValue(
          "reportTimestep",
          hydraulicModel.epsTiming.reportTimestep || ONE_HOUR,
        );
      if (!values.patternTimestep)
        void setFieldValue(
          "patternTimestep",
          hydraulicModel.epsTiming.patternTimestep || ONE_HOUR,
        );
    }
  };

  return (
    <Section title={translate("simulationSettings.calculationTimes")}>
      <SettingsGrid>
        <SettingsLabel>
          {translate("simulationSettings.timeAnalysisMode")}
        </SettingsLabel>
        <SettingsInput wide>
          <Selector
            ariaLabel={translate("simulationSettings.timeAnalysisMode")}
            options={simulationModeOptions}
            selected={values.simulationMode}
            onChange={handleSimulationModeChange}
            disabled={readonly}
            styleOptions={{
              border: true,
              textSize: "text-sm",
              paddingY: 2,
            }}
          />
        </SettingsInput>

        <SettingsLabel>
          {translate("simulationSettings.totalDuration")}
        </SettingsLabel>
        <SettingsInput>
          <TimingInput
            label={translate("simulationSettings.totalDuration")}
            value={values.duration}
            disabled={!isEPS}
            readonly={readonly}
            onChange={(newValue) => setFieldValue("duration", newValue)}
            hasError={fieldErrors.duration}
          />
        </SettingsInput>

        <SettingsLabel>
          {translate("simulationSettings.hydraulicTimestep")}
        </SettingsLabel>
        <SettingsInput>
          <TimingInput
            label={translate("simulationSettings.hydraulicTimestep")}
            value={values.hydraulicTimestep}
            disabled={!isEPS}
            readonly={readonly}
            onChange={(newValue) =>
              setFieldValue("hydraulicTimestep", newValue)
            }
            hasError={fieldErrors.hydraulicTimestep}
          />
        </SettingsInput>

        <SettingsLabel>
          {translate("simulationSettings.reportingTimestep")}
        </SettingsLabel>
        <SettingsInput>
          <TimingInput
            label={translate("simulationSettings.reportingTimestep")}
            value={values.reportTimestep}
            disabled={!isEPS}
            readonly={readonly}
            onChange={(newValue) => setFieldValue("reportTimestep", newValue)}
            hasError={fieldErrors.reportTimestep}
          />
        </SettingsInput>

        <SettingsLabel>
          {translate("simulationSettings.patternTimestep")}
        </SettingsLabel>
        <SettingsInput>
          <TimingInput
            label={translate("simulationSettings.patternTimestep")}
            value={values.patternTimestep}
            disabled={!isEPS}
            readonly={readonly}
            onChange={(newValue) => setFieldValue("patternTimestep", newValue)}
            hasError={fieldErrors.patternTimestep}
          />
        </SettingsInput>

        <ValidationMessages
          hasMissingValues={hasMissingValues}
          hasZeroValues={hasZeroValues}
        />
      </SettingsGrid>
    </Section>
  );
};

const SettingsGrid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 items-center">
    {children}
  </div>
);

const SettingsLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="text-sm text-gray-500 whitespace-nowrap">{children}</label>
);

const SettingsInput = ({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) => <div className={wide ? "w-36 ml-auto" : "w-16 ml-auto"}>{children}</div>;

const ValidationMessages = ({
  hasMissingValues,
  hasZeroValues,
}: {
  hasMissingValues: boolean;
  hasZeroValues: boolean;
}) => {
  const translate = useTranslate();

  const messages: string[] = [];
  if (hasMissingValues)
    messages.push(translate("simulationSettings.epsMissingValues"));
  if (hasZeroValues)
    messages.push(translate("simulationSettings.epsZeroValues"));

  const hasAnyError = messages.length > 0;

  return (
    <>
      <p
        className={`col-span-2 text-sm font-semibold mt-1 ${hasAnyError ? "text-orange-800" : "invisible"}`}
      >
        {messages[0] ?? "\u00A0"}
      </p>
      <p
        className={`col-span-2 text-sm font-semibold ${messages.length > 1 ? "text-orange-800" : "invisible"}`}
      >
        {messages[1] ?? "\u00A0"}
      </p>
    </>
  );
};

const TimingInput = ({
  label,
  value,
  disabled,
  readonly = false,
  onChange,
  hasError = false,
}: {
  label: string;
  value: number | undefined;
  disabled: boolean;
  readonly?: boolean;
  onChange: (value: number | undefined) => void;
  hasError?: boolean;
}) => {
  const translate = useTranslate();

  if (readonly) {
    return (
      <span className="block w-full p-2 text-xs text-gray-500 bg-gray-50 border border-gray-300 rounded-sm cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400">
        {disabled
          ? translate("simulationSettings.notAvailable")
          : formatSecondsToDisplay(value) || "-"}
      </span>
    );
  }

  if (disabled) {
    return (
      <span className="block w-full p-2 text-xs text-gray-500 bg-gray-50 border border-gray-300 rounded-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400">
        {translate("simulationSettings.notAvailable")}
      </span>
    );
  }

  return (
    <TimeField
      label={label}
      value={value}
      onChangeValue={onChange}
      hasError={hasError}
    />
  );
};
