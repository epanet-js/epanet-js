import type {
  Junction,
  Pipe,
  Pump,
  Valve,
  Reservoir,
  Tank,
} from "src/hydraulic-model/asset-types";
import type { AssetType } from "src/hydraulic-model/asset-types/types";
import type { AssetId } from "src/hydraulic-model/asset-types/base-asset";
import {
  calculateAverageDemand,
  getJunctionDemands,
  getCustomerPointDemands,
  HydraulicModel,
} from "src/hydraulic-model";
import { getActiveCustomerPoints } from "src/hydraulic-model/customer-points";
import type { TranslateFn } from "src/hooks/use-translate";
import { ResultsReader } from "src/simulation";

export type AssetRow = Record<string, unknown> & { id: AssetId };

export function buildRows(
  assetType: AssetType,
  assetIds: AssetId[],
  hydraulicModel: HydraulicModel,
  simulation: ResultsReader | null,
  translate: TranslateFn,
): AssetRow[] {
  const result: AssetRow[] = [];
  for (const id of assetIds) {
    const asset = hydraulicModel.assets.get(id);
    if (!asset) continue;
    const simFields = simulation
      ? buildSimRow(assetType, id, simulation, translate)
      : {};
    const computedFields = buildComputedFields(assetType, id, hydraulicModel);
    result.push({
      ...buildAssetRow(assetType, asset),
      ...simFields,
      ...computedFields,
    });
  }
  return result;
}

function buildSimRow(
  type: AssetType,
  assetId: AssetId,
  simulation: ResultsReader,
  translate: TranslateFn,
): Record<string, number | string | null> {
  const qualityFields = (
    sim:
      | {
          waterAge: number | null;
          waterTrace: number | null;
          chemicalConcentration: number | null;
        }
      | null
      | undefined,
  ) => ({
    sim_waterAge: sim?.waterAge ?? null,
    sim_waterTrace: sim?.waterTrace ?? null,
    sim_chemicalConcentration: sim?.chemicalConcentration ?? null,
  });

  switch (type) {
    case "junction": {
      const sim = simulation.getJunction(assetId);
      return {
        sim_pressure: sim?.pressure ?? null,
        sim_head: sim?.head ?? null,
        sim_demand: sim?.demand ?? null,
        ...qualityFields(sim),
      };
    }
    case "pipe": {
      const sim = simulation.getPipe(assetId);
      return {
        sim_flow: sim?.flow ?? null,
        sim_velocity: sim?.velocity ?? null,
        sim_headloss: sim?.headloss ?? null,
        sim_unitHeadloss: sim?.unitHeadloss ?? null,
        sim_status: sim?.status ? translate(`pipe.${sim.status}`) : "",
        ...qualityFields(sim),
      };
    }
    case "pump": {
      const sim = simulation.getPump(assetId);
      const energy = simulation.getPumpEnergy(assetId);
      return {
        sim_flow: sim?.flow ?? null,
        sim_headloss: sim?.headloss ?? null,
        sim_status: sim?.status ? translate(`pump.${sim.status}`) : "",
        ...qualityFields(sim),
        sim_utilization: energy?.utilization ?? null,
        sim_averageEfficiency: energy?.averageEfficiency ?? null,
        sim_averageKwPerFlowUnit: energy?.averageKwPerFlowUnit ?? null,
        sim_averageKw: energy?.averageKw ?? null,
        sim_peakKw: energy?.peakKw ?? null,
        sim_averageCostPerDay: energy?.averageCostPerDay ?? null,
        sim_demandCharge: energy?.demandCharge ?? null,
      };
    }
    case "valve": {
      const sim = simulation.getValve(assetId);
      return {
        sim_flow: sim?.flow ?? null,
        sim_velocity: sim?.velocity ?? null,
        sim_headloss: sim?.headloss ?? null,
        sim_status: sim?.status ? translate(`valve.${sim.status}`) : "",
        ...qualityFields(sim),
      };
    }
    case "reservoir": {
      const r = simulation.getReservoir(assetId);
      return {
        sim_head: r?.head ?? null,
        sim_netFlow: r?.netFlow ?? null,
        ...qualityFields(r),
      };
    }
    case "tank": {
      const sim = simulation.getTank(assetId);
      return {
        sim_head: sim?.head ?? null,
        sim_level: sim?.level ?? null,
        sim_volume: sim?.volume ?? null,
        sim_netFlow: sim?.netFlow ?? null,
        ...qualityFields(sim),
      };
    }
  }
}

function buildComputedFields(
  assetType: AssetType,
  assetId: AssetId,
  hydraulicModel: HydraulicModel,
): Record<string, unknown> {
  if (assetType !== "junction") return {};

  const junctionDemands = getJunctionDemands(hydraulicModel.demands, assetId);
  const avgDemand = calculateAverageDemand(
    junctionDemands,
    hydraulicModel.patterns,
  );
  const customerPoints = getActiveCustomerPoints(
    hydraulicModel.customerPointsLookup,
    hydraulicModel.assets,
    assetId,
  );
  const avgCustomerDemand = customerPoints.reduce(
    (sum, cp) =>
      sum +
      calculateAverageDemand(
        getCustomerPointDemands(hydraulicModel.demands, cp.id),
        hydraulicModel.patterns,
      ),
    0,
  );
  return {
    avgDemand,
    avgCustomerDemand,
    customerPointCount: customerPoints.length,
  };
}

function buildAssetRow(
  assetType: AssetType,
  asset: Junction | Pipe | Pump | Valve | Reservoir | Tank,
): AssetRow {
  const base = { id: asset.id, label: asset.label, isActive: asset.isActive };
  switch (assetType) {
    case "junction": {
      const a = asset as Junction;
      return {
        ...base,
        elevation: a.elevation,
        emitterCoefficient: a.emitterCoefficient,
        initialQuality: a.initialQuality,
        chemicalSourceType: a.chemicalSourceType,
        chemicalSourceStrength: a.chemicalSourceStrength,
        chemicalSourcePatternId: a.chemicalSourcePatternId,
      };
    }
    case "pipe": {
      const a = asset as Pipe;
      return {
        ...base,
        initialStatus: a.initialStatus,
        diameter: a.diameter,
        length: a.length,
        roughness: a.roughness,
        minorLoss: a.minorLoss,
        bulkReactionCoeff: a.bulkReactionCoeff,
        wallReactionCoeff: a.wallReactionCoeff,
      };
    }
    case "pump": {
      const a = asset as Pump;
      return {
        ...base,
        initialStatus: a.initialStatus,
        speed: a.speed,
        curveId: a.curveId,
        energyPrice: a.energyPrice,
        speedPatternId: a.speedPatternId,
        efficiencyCurveId: a.efficiencyCurveId,
        energyPricePatternId: a.energyPricePatternId,
      };
    }
    case "valve": {
      const a = asset as Valve;
      return {
        ...base,
        kind: a.kind,
        setting: a.setting,
        initialStatus: a.initialStatus,
        diameter: a.diameter,
        minorLoss: a.minorLoss,
        curveId: a.curveId,
      };
    }
    case "reservoir": {
      const a = asset as Reservoir;
      return {
        ...base,
        elevation: a.elevation,
        head: a.head,
        headPatternId: a.headPatternId,
        initialQuality: a.initialQuality,
        chemicalSourceType: a.chemicalSourceType,
        chemicalSourceStrength: a.chemicalSourceStrength,
        chemicalSourcePatternId: a.chemicalSourcePatternId,
      };
    }
    case "tank": {
      const a = asset as Tank;
      return {
        ...base,
        elevation: a.elevation,
        initialLevel: a.initialLevel,
        minLevel: a.minLevel,
        maxLevel: a.maxLevel,
        minVolume: a.minVolume,
        diameter: a.diameter,
        volumeCurveId: a.volumeCurveId,
        initialQuality: a.initialQuality,
        bulkReactionCoeff: a.bulkReactionCoeff,
        mixingModel: a.mixingModel,
        mixingFraction: a.mixingFraction,
        overflow: a.overflow,
        chemicalSourceType: a.chemicalSourceType,
        chemicalSourceStrength: a.chemicalSourceStrength,
        chemicalSourcePatternId: a.chemicalSourcePatternId,
      };
    }
  }
}
