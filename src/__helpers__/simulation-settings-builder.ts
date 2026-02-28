import { nanoid } from "nanoid";
import {
  defaultTiming,
  type Timing,
  type SimulationSettings,
} from "src/simulation/simulation-settings";

export class SimulationSettingsBuilder {
  private timingValue: Timing = defaultTiming;

  static with() {
    return new SimulationSettingsBuilder();
  }

  timing(timing: Partial<Timing>) {
    this.timingValue = { ...defaultTiming, ...timing };
    return this;
  }

  build(): SimulationSettings {
    return { version: nanoid(), timing: this.timingValue };
  }
}
