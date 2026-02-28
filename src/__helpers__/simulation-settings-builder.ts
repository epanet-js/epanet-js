import { nanoid } from "nanoid";
import type {
  EPSTiming,
  SimulationSettings,
} from "src/simulation/simulation-settings";

export class SimulationSettingsBuilder {
  private epsTiming: EPSTiming = {};

  static with() {
    return new SimulationSettingsBuilder();
  }

  eps(epsTiming: EPSTiming) {
    this.epsTiming = epsTiming;
    return this;
  }

  build(): SimulationSettings {
    return { version: nanoid(), epsTiming: this.epsTiming };
  }
}
