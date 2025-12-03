import { useAtomValue } from "jotai";
import { useCallback } from "react";

import { DialogContainer, DialogHeader, useDialogState } from "../dialog";
import { useTranslate } from "src/hooks/use-translate";
import { Form, Formik } from "formik";
import { NumericField } from "../form/numeric-field";
import { TimeField } from "../form/time-field";
import { dataAtom } from "src/state/jotai";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { SimpleDialogActions } from "src/components/dialog";
import { usePersistence } from "src/lib/persistence/context";
import { Section } from "../form/fields";
import { useUserTracking } from "src/infra/user-tracking";
import { SettingsIcon } from "src/icons";
import { Selector } from "../form/selector";
import { changeDemandSettings } from "src/hydraulic-model/model-operations/change-demand-settings";
import { changeEPSTiming } from "src/hydraulic-model/model-operations/change-eps-timing";

type SimulationModeOption = "steadyState" | "eps";

type FormValues = {
  demandMultiplier: number;
  simulationMode: SimulationModeOption;
  duration: number | undefined;
  hydraulicTimestep: number | undefined;
  reportTimestep: number | undefined;
  patternTimestep: number | undefined;
};

export const SimulationSettingsEPSDialog = () => {
  const translate = useTranslate();
  const { closeDialog } = useDialogState();

  const { hydraulicModel } = useAtomValue(dataAtom);
  const rep = usePersistence();
  const transact = rep.useTransact();
  const userTracking = useUserTracking();

  const handleSubmit = useCallback(
    (values: FormValues) => {
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

      const timingMoment = changeEPSTiming(hydraulicModel, {
        duration: values.simulationMode === "steadyState" ? 0 : values.duration,
        hydraulicTimestep: values.hydraulicTimestep,
        reportTimestep: values.reportTimestep,
        patternTimestep: values.patternTimestep,
      });
      transact(timingMoment);

      closeDialog();
    },
    [hydraulicModel, transact, closeDialog, userTracking],
  );

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
        {({ values, setFieldValue }) => {
          const isEPS = values.simulationMode === "eps";
          const hasInvalidDuration =
            isEPS && (values.duration === undefined || values.duration === 0);

          return (
            <Form>
              <div className="flex flex-wrap justify-between gap-2">
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

                <Section
                  title={translate("simulationSettings.calculationTimes")}
                >
                  <SettingsGrid>
                    <SettingsLabel>
                      {translate("simulationSettings.timeAnalysisMode")}
                    </SettingsLabel>
                    <SettingsInput wide>
                      <Selector
                        ariaLabel={translate(
                          "simulationSettings.timeAnalysisMode",
                        )}
                        options={simulationModeOptions}
                        selected={values.simulationMode}
                        onChange={(newValue) =>
                          setFieldValue("simulationMode", newValue)
                        }
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
                        onChange={(newValue) =>
                          setFieldValue("duration", newValue)
                        }
                        hasError={hasInvalidDuration}
                      />
                    </SettingsInput>

                    <SettingsLabel>
                      {translate("simulationSettings.hydraulicTimestep")}
                    </SettingsLabel>
                    <SettingsInput>
                      <TimingInput
                        label={translate(
                          "simulationSettings.hydraulicTimestep",
                        )}
                        value={values.hydraulicTimestep}
                        disabled={!isEPS}
                        onChange={(newValue) =>
                          setFieldValue("hydraulicTimestep", newValue)
                        }
                      />
                    </SettingsInput>

                    <SettingsLabel>
                      {translate("simulationSettings.reportingTimestep")}
                    </SettingsLabel>
                    <SettingsInput>
                      <TimingInput
                        label={translate(
                          "simulationSettings.reportingTimestep",
                        )}
                        value={values.reportTimestep}
                        disabled={!isEPS}
                        onChange={(newValue) =>
                          setFieldValue("reportTimestep", newValue)
                        }
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
                        onChange={(newValue) =>
                          setFieldValue("patternTimestep", newValue)
                        }
                      />
                    </SettingsInput>

                    <p
                      className={`col-span-2 text-sm font-semibold mt-1 ${hasInvalidDuration ? "text-orange-800" : "invisible"}`}
                    >
                      {translate("simulationSettings.epsZeroDuration")}
                    </p>
                  </SettingsGrid>
                </Section>
              </div>
              <SimpleDialogActions
                onClose={closeDialog}
                action={translate("simulationSettings.save")}
                isDisabled={hasInvalidDuration}
              />
            </Form>
          );
        }}
      </Formik>
    </DialogContainer>
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

const TimingInput = ({
  label,
  value,
  disabled,
  onChange,
  hasError = false,
}: {
  label: string;
  value: number | undefined;
  disabled: boolean;
  onChange: (value: number | undefined) => void;
  hasError?: boolean;
}) => {
  const translate = useTranslate();

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
