import { nanoid } from "nanoid";
import {
  type SimulationSettings,
  type DemandModel,
  type UnbalancedMode,
  defaultHydraulicsValues,
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
    subcategories: [
      { id: "demands-calculation", label: "Calculation" },
      { id: "demands-emitters", label: "Emitters" },
    ],
  },
  {
    id: "hydraulics",
    label: "Hydraulics",
    subcategories: [
      { id: "hydraulics-convergence", label: "Convergence" },
      { id: "hydraulics-solver", label: "Solver controls" },
      { id: "hydraulics-fluid", label: "Fluid properties" },
    ],
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
  emitterExponent: number;
  trials: number;
  accuracy: number;
  unbalancedMode: UnbalancedMode;
  unbalancedExtraTrials: number;
  headError: number;
  flowChange: number;
  checkFreq: number;
  maxCheck: number;
  dampLimit: number;
  viscosity: number;
  specificGravity: number;
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
    emitterExponent: settings.emitterExponent,
    trials: settings.trials ?? defaultHydraulicsValues.trials,
    accuracy: settings.accuracy ?? defaultHydraulicsValues.accuracy,
    unbalancedMode:
      settings.unbalancedMode ?? defaultHydraulicsValues.unbalancedMode,
    unbalancedExtraTrials:
      settings.unbalancedExtraTrials ??
      defaultHydraulicsValues.unbalancedExtraTrials,
    headError: settings.headError ?? defaultHydraulicsValues.headError,
    flowChange: settings.flowChange ?? defaultHydraulicsValues.flowChange,
    checkFreq: settings.checkFreq ?? defaultHydraulicsValues.checkFreq,
    maxCheck: settings.maxCheck ?? defaultHydraulicsValues.maxCheck,
    dampLimit: settings.dampLimit ?? defaultHydraulicsValues.dampLimit,
    viscosity: settings.viscosity ?? defaultHydraulicsValues.viscosity,
    specificGravity:
      settings.specificGravity ?? defaultHydraulicsValues.specificGravity,
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
    values.pressureExponent !== settings.pressureExponent ||
    values.emitterExponent !== settings.emitterExponent ||
    values.trials !== (settings.trials ?? defaultHydraulicsValues.trials) ||
    values.accuracy !==
      (settings.accuracy ?? defaultHydraulicsValues.accuracy) ||
    values.unbalancedMode !==
      (settings.unbalancedMode ?? defaultHydraulicsValues.unbalancedMode) ||
    values.unbalancedExtraTrials !==
      (settings.unbalancedExtraTrials ??
        defaultHydraulicsValues.unbalancedExtraTrials) ||
    values.headError !==
      (settings.headError ?? defaultHydraulicsValues.headError) ||
    values.flowChange !==
      (settings.flowChange ?? defaultHydraulicsValues.flowChange) ||
    values.checkFreq !==
      (settings.checkFreq ?? defaultHydraulicsValues.checkFreq) ||
    values.maxCheck !==
      (settings.maxCheck ?? defaultHydraulicsValues.maxCheck) ||
    values.dampLimit !==
      (settings.dampLimit ?? defaultHydraulicsValues.dampLimit) ||
    values.viscosity !==
      (settings.viscosity ?? defaultHydraulicsValues.viscosity) ||
    values.specificGravity !==
      (settings.specificGravity ?? defaultHydraulicsValues.specificGravity)
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
    emitterExponent: values.emitterExponent,
    trials: values.trials,
    accuracy: values.accuracy,
    unbalancedMode: values.unbalancedMode,
    unbalancedExtraTrials: values.unbalancedExtraTrials,
    headError: values.headError,
    flowChange: values.flowChange,
    checkFreq: values.checkFreq,
    maxCheck: values.maxCheck,
    dampLimit: values.dampLimit,
    viscosity: values.viscosity,
    specificGravity: values.specificGravity,
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
