import { nanoid } from "nanoid";
import {
  defaultTiming,
  defaultDemandSettings,
  type Timing,
  type DemandSettings,
  type SimulationSettings,
} from "src/simulation/simulation-settings";

export class SimulationSettingsBuilder {
  private timingValue: Timing = defaultTiming;
  private demandsValue: DemandSettings = defaultDemandSettings;

  static with() {
    return new SimulationSettingsBuilder();
  }

  timing(timing: Partial<Timing>) {
    this.timingValue = { ...defaultTiming, ...timing };
    return this;
  }

  demands(demands: Partial<DemandSettings>) {
    this.demandsValue = { ...defaultDemandSettings, ...demands };
    return this;
  }

  build(): SimulationSettings {
    return {
      version: nanoid(),
      timing: this.timingValue,
      demands: this.demandsValue,
    };
  }
}
