import { nanoid } from "nanoid";
import {
  defaultTiming,
  defaultSimulationSettings,
  type Timing,
  type SimulationSettings,
} from "src/simulation/simulation-settings";

export class SimulationSettingsBuilder {
  private timingValue: Timing = defaultTiming;
  private globalDemandMultiplierValue: number =
    defaultSimulationSettings.globalDemandMultiplier;

  static with() {
    return new SimulationSettingsBuilder();
  }

  timing(timing: Partial<Timing>) {
    this.timingValue = { ...defaultTiming, ...timing };
    return this;
  }

  globalDemandMultiplier(value: number) {
    this.globalDemandMultiplierValue = value;
    return this;
  }

  build(): SimulationSettings {
    return {
      version: nanoid(),
      timing: this.timingValue,
      globalDemandMultiplier: this.globalDemandMultiplierValue,
    };
  }
}
