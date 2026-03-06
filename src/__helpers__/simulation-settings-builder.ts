import { nanoid } from "nanoid";
import {
  defaultTiming,
  defaultSimulationSettings,
  type Timing,
  type SimulationSettings,
  type DemandModel,
  type UnbalancedMode,
  type QualitySimulationType,
  type QualityMassUnit,
  type StatusReport,
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
  private qualitySimulationTypeValue: QualitySimulationType =
    defaultSimulationSettings.qualitySimulationType;
  private qualityChemicalNameValue: string =
    defaultSimulationSettings.qualityChemicalName;
  private qualityMassUnitValue: QualityMassUnit =
    defaultSimulationSettings.qualityMassUnit;
  private qualityTraceNodeIdValue: number | null =
    defaultSimulationSettings.qualityTraceNodeId;
  private toleranceValue: number = defaultSimulationSettings.tolerance;
  private diffusivityValue: number = defaultSimulationSettings.diffusivity;
  private reactionBulkOrderValue: number =
    defaultSimulationSettings.reactionBulkOrder;
  private reactionWallOrderValue: number =
    defaultSimulationSettings.reactionWallOrder;
  private reactionTankOrderValue: number =
    defaultSimulationSettings.reactionTankOrder;
  private reactionGlobalBulkValue: number =
    defaultSimulationSettings.reactionGlobalBulk;
  private reactionGlobalWallValue: number =
    defaultSimulationSettings.reactionGlobalWall;
  private reactionLimitingPotentialValue: number =
    defaultSimulationSettings.reactionLimitingPotential;
  private reactionRoughnessCorrelationValue: number =
    defaultSimulationSettings.reactionRoughnessCorrelation;
  private reportEnergyValue: boolean = defaultSimulationSettings.reportEnergy;
  private energyGlobalEfficiencyValue: number =
    defaultSimulationSettings.energyGlobalEfficiency;
  private energyGlobalPriceValue: number =
    defaultSimulationSettings.energyGlobalPrice;
  private energyGlobalPatternIdValue: number | null =
    defaultSimulationSettings.energyGlobalPatternId;
  private energyDemandChargeValue: number =
    defaultSimulationSettings.energyDemandCharge;
  private statusReportValue: StatusReport =
    defaultSimulationSettings.statusReport;

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

  qualitySimulationType(value: QualitySimulationType) {
    this.qualitySimulationTypeValue = value;
    return this;
  }

  qualityChemicalName(value: string) {
    this.qualityChemicalNameValue = value;
    return this;
  }

  qualityMassUnit(value: QualityMassUnit) {
    this.qualityMassUnitValue = value;
    return this;
  }

  qualityTraceNodeId(value: number | null) {
    this.qualityTraceNodeIdValue = value;
    return this;
  }

  tolerance(value: number) {
    this.toleranceValue = value;
    return this;
  }

  diffusivity(value: number) {
    this.diffusivityValue = value;
    return this;
  }

  reactionBulkOrder(value: number) {
    this.reactionBulkOrderValue = value;
    return this;
  }

  reactionWallOrder(value: number) {
    this.reactionWallOrderValue = value;
    return this;
  }

  reactionTankOrder(value: number) {
    this.reactionTankOrderValue = value;
    return this;
  }

  reactionGlobalBulk(value: number) {
    this.reactionGlobalBulkValue = value;
    return this;
  }

  reactionGlobalWall(value: number) {
    this.reactionGlobalWallValue = value;
    return this;
  }

  reactionLimitingPotential(value: number) {
    this.reactionLimitingPotentialValue = value;
    return this;
  }

  reactionRoughnessCorrelation(value: number) {
    this.reactionRoughnessCorrelationValue = value;
    return this;
  }

  reportEnergy(value: boolean) {
    this.reportEnergyValue = value;
    return this;
  }

  energyGlobalEfficiency(value: number) {
    this.energyGlobalEfficiencyValue = value;
    return this;
  }

  energyGlobalPrice(value: number) {
    this.energyGlobalPriceValue = value;
    return this;
  }

  energyGlobalPatternId(value: number | null) {
    this.energyGlobalPatternIdValue = value;
    return this;
  }

  energyDemandCharge(value: number) {
    this.energyDemandChargeValue = value;
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
      qualitySimulationType: this.qualitySimulationTypeValue,
      qualityChemicalName: this.qualityChemicalNameValue,
      qualityMassUnit: this.qualityMassUnitValue,
      qualityTraceNodeId: this.qualityTraceNodeIdValue,
      tolerance: this.toleranceValue,
      diffusivity: this.diffusivityValue,
      reactionBulkOrder: this.reactionBulkOrderValue,
      reactionWallOrder: this.reactionWallOrderValue,
      reactionTankOrder: this.reactionTankOrderValue,
      reactionGlobalBulk: this.reactionGlobalBulkValue,
      reactionGlobalWall: this.reactionGlobalWallValue,
      reactionLimitingPotential: this.reactionLimitingPotentialValue,
      reactionRoughnessCorrelation: this.reactionRoughnessCorrelationValue,
      reportEnergy: this.reportEnergyValue,
      energyGlobalEfficiency: this.energyGlobalEfficiencyValue,
      energyGlobalPrice: this.energyGlobalPriceValue,
      energyGlobalPatternId: this.energyGlobalPatternIdValue,
      energyDemandCharge: this.energyDemandChargeValue,
      statusReport: this.statusReportValue,
    };
  }
}
