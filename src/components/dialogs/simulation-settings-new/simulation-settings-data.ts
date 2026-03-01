import { nanoid } from "nanoid";
import type { SimulationSettings } from "src/simulation/simulation-settings";

export type OptionCategory = {
  id: string;
  label: string;
};

export const simulationSettingsCategories: OptionCategory[] = [
  {
    id: "times",
    label: "Times",
  },
];

export const buildSectionIds = (): string[] => {
  return simulationSettingsCategories.map((category) => category.id);
};

export type SimulationModeOption = "steadyState" | "eps";

export type FormValues = {
  simulationMode: SimulationModeOption;
  duration: number | undefined;
  hydraulicTimestep: number | undefined;
  reportTimestep: number | undefined;
  patternTimestep: number | undefined;
};

export const buildInitialValues = (
  settings: SimulationSettings,
): FormValues => {
  const { timing } = settings;
  return {
    simulationMode: timing.duration > 0 ? "eps" : "steadyState",
    duration: timing.duration,
    hydraulicTimestep: timing.hydraulicTimestep,
    reportTimestep: timing.reportTimestep,
    patternTimestep: timing.patternTimestep,
  };
};

export const hasChanges = (
  values: FormValues,
  settings: SimulationSettings,
): boolean => {
  const { timing } = settings;
  const newDuration =
    values.simulationMode === "steadyState" ? 0 : values.duration;
  return (
    newDuration !== timing.duration ||
    values.hydraulicTimestep !== timing.hydraulicTimestep ||
    values.reportTimestep !== timing.reportTimestep ||
    values.patternTimestep !== timing.patternTimestep
  );
};

export const buildUpdatedSettings = (
  values: FormValues,
  settings: SimulationSettings,
): SimulationSettings => {
  const { timing } = settings;
  return {
    version: nanoid(),
    timing: {
      duration:
        values.simulationMode === "steadyState" ? 0 : (values.duration ?? 0),
      hydraulicTimestep: values.hydraulicTimestep ?? timing.hydraulicTimestep,
      reportTimestep: values.reportTimestep ?? timing.reportTimestep,
      patternTimestep: values.patternTimestep ?? timing.patternTimestep,
    },
  };
};
