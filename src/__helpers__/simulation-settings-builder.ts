import { nanoid } from "nanoid";
import {
  defaultTiming,
  defaultSimulationSettings,
  type Timing,
  type SimulationSettings,
  type DemandModel,
} from "src/simulation/simulation-settings";

export class SimulationSettingsBuilder {
  private timingValue: Timing = defaultTiming;
  private globalDemandMultiplierValue: number =
    defaultSimulationSettings.globalDemandMultiplier;
  private demandModelValue: DemandModel = defaultSimulationSettings.demandModel;
  private minimumPressureValue: number =
    defaultSimulationSettings.minimumPressure;
  private requiredPressureValue: number =
    defaultSimulationSettings.requiredPressure;
  private pressureExponentValue: number =
    defaultSimulationSettings.pressureExponent;
  private emitterExponentValue: number =
    defaultSimulationSettings.emitterExponent;

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

  demandModel(value: DemandModel) {
    this.demandModelValue = value;
    return this;
  }

  minimumPressure(value: number) {
    this.minimumPressureValue = value;
    return this;
  }

  requiredPressure(value: number) {
    this.requiredPressureValue = value;
    return this;
  }

  pressureExponent(value: number) {
    this.pressureExponentValue = value;
    return this;
  }

  emitterExponent(value: number) {
    this.emitterExponentValue = value;
    return this;
  }

  build(): SimulationSettings {
    return {
      version: nanoid(),
      timing: this.timingValue,
      globalDemandMultiplier: this.globalDemandMultiplierValue,
      demandModel: this.demandModelValue,
      minimumPressure: this.minimumPressureValue,
      requiredPressure: this.requiredPressureValue,
      pressureExponent: this.pressureExponentValue,
      emitterExponent: this.emitterExponentValue,
    };
  }
}
