import { nanoid } from "nanoid";
import {
  type SimulationSettings,
  type DemandModel,
} from "src/simulation/simulation-settings";

export type OptionSubcategory = {
  id: string;
  label: string;
};

export type OptionCategory = {
  id: string;
  label: string;
  subcategories?: OptionSubcategory[];
};

export const simulationSettingsCategories: OptionCategory[] = [
  {
    id: "times",
    label: "Times",
  },
  {
    id: "demands",
    label: "Demands",
    subcategories: [{ id: "demands-calculation", label: "Calculation" }],
  },
];

export const buildSectionIds = (): string[] => {
  return simulationSettingsCategories.flatMap((category) => [
    category.id,
    ...(category.subcategories?.map((sub) => sub.id) ?? []),
  ]);
};

export type SimulationModeOption = "steadyState" | "eps";

export type FormValues = {
  simulationMode: SimulationModeOption;
  duration: number | undefined;
  hydraulicTimestep: number | undefined;
  reportTimestep: number | undefined;
  patternTimestep: number | undefined;
  qualityTimestep: number | undefined;
  ruleTimestep: number | undefined;
  globalDemandMultiplier: number;
  demandModel: DemandModel;
  minimumPressure: number;
  requiredPressure: number;
  pressureExponent: number;
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
    qualityTimestep: timing.qualityTimestep,
    ruleTimestep: timing.ruleTimestep,
    globalDemandMultiplier: settings.globalDemandMultiplier,
    demandModel: settings.demandModel,
    minimumPressure: settings.minimumPressure,
    requiredPressure: settings.requiredPressure,
    pressureExponent: settings.pressureExponent,
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
    values.patternTimestep !== timing.patternTimestep ||
    values.qualityTimestep !== timing.qualityTimestep ||
    values.ruleTimestep !== timing.ruleTimestep ||
    values.globalDemandMultiplier !== settings.globalDemandMultiplier ||
    values.demandModel !== settings.demandModel ||
    values.minimumPressure !== settings.minimumPressure ||
    values.requiredPressure !== settings.requiredPressure ||
    values.pressureExponent !== settings.pressureExponent
  );
};

export const buildUpdatedSettings = (
  values: FormValues,
  settings: SimulationSettings,
): SimulationSettings => {
  const { timing } = settings;
  return {
    version: nanoid(),
    globalDemandMultiplier: values.globalDemandMultiplier,
    demandModel: values.demandModel,
    minimumPressure: values.minimumPressure,
    requiredPressure: values.requiredPressure,
    pressureExponent: values.pressureExponent,
    timing: {
      duration:
        values.simulationMode === "steadyState" ? 0 : (values.duration ?? 0),
      hydraulicTimestep: values.hydraulicTimestep ?? timing.hydraulicTimestep,
      reportTimestep: values.reportTimestep ?? timing.reportTimestep,
      patternTimestep: values.patternTimestep ?? timing.patternTimestep,
      qualityTimestep: values.qualityTimestep ?? timing.qualityTimestep,
      ruleTimestep: values.ruleTimestep ?? timing.ruleTimestep,
    },
  };
};
