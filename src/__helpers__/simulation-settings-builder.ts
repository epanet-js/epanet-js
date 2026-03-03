import { nanoid } from "nanoid";
import {
  defaultTiming,
  defaultSimulationSettings,
  type Timing,
  type SimulationSettings,
  type DemandModel,
  type UnbalancedMode,
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
  private trialsValue?: number;
  private accuracyValue?: number;
  private unbalancedModeValue?: UnbalancedMode;
  private unbalancedExtraTrialsValue?: number;
  private headErrorValue?: number;
  private flowChangeValue?: number;
  private checkFreqValue?: number;
  private maxCheckValue?: number;
  private dampLimitValue?: number;
  private viscosityValue?: number;
  private specificGravityValue?: number;

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

  trials(value: number) {
    this.trialsValue = value;
    return this;
  }

  accuracy(value: number) {
    this.accuracyValue = value;
    return this;
  }

  unbalancedMode(value: UnbalancedMode) {
    this.unbalancedModeValue = value;
    return this;
  }

  unbalancedExtraTrials(value: number) {
    this.unbalancedExtraTrialsValue = value;
    return this;
  }

  headError(value: number) {
    this.headErrorValue = value;
    return this;
  }

  flowChange(value: number) {
    this.flowChangeValue = value;
    return this;
  }

  checkFreq(value: number) {
    this.checkFreqValue = value;
    return this;
  }

  maxCheck(value: number) {
    this.maxCheckValue = value;
    return this;
  }

  dampLimit(value: number) {
    this.dampLimitValue = value;
    return this;
  }

  viscosity(value: number) {
    this.viscosityValue = value;
    return this;
  }

  specificGravity(value: number) {
    this.specificGravityValue = value;
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
      ...(this.trialsValue !== undefined && { trials: this.trialsValue }),
      ...(this.accuracyValue !== undefined && {
        accuracy: this.accuracyValue,
      }),
      ...(this.unbalancedModeValue !== undefined && {
        unbalancedMode: this.unbalancedModeValue,
      }),
      ...(this.unbalancedExtraTrialsValue !== undefined && {
        unbalancedExtraTrials: this.unbalancedExtraTrialsValue,
      }),
      ...(this.headErrorValue !== undefined && {
        headError: this.headErrorValue,
      }),
      ...(this.flowChangeValue !== undefined && {
        flowChange: this.flowChangeValue,
      }),
      ...(this.checkFreqValue !== undefined && {
        checkFreq: this.checkFreqValue,
      }),
      ...(this.maxCheckValue !== undefined && {
        maxCheck: this.maxCheckValue,
      }),
      ...(this.dampLimitValue !== undefined && {
        dampLimit: this.dampLimitValue,
      }),
      ...(this.viscosityValue !== undefined && {
        viscosity: this.viscosityValue,
      }),
      ...(this.specificGravityValue !== undefined && {
        specificGravity: this.specificGravityValue,
      }),
    };
  }
}
