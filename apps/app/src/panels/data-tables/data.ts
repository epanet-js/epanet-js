import {
  type Pipe,
  type Pump,
  type Valve,
  type Tank,
  type AssetType,
  type AssetId,
  tankVolumeCurveRange,
  getActiveCustomerPoints,
} from "@epanet-js/hydraulic-model";
import {
  calculateAverageDemand,
  getJunctionDemands,
  getCustomerPointDemands,
  HydraulicModel,
} from "src/hydraulic-model";
import type { CustomerPointId } from "@epanet-js/hydraulic-model";
import type { TranslateFn } from "src/hooks/use-translate";
import { ResultsReader } from "src/simulation";

export type AssetRow = Record<string, unknown> & { id: AssetId };

export type AssetAccessorCtx = {
  model: HydraulicModel;
  simulation: ResultsReader | null;
  translate: TranslateFn;
};

const ASSET_COMPUTED_KEYS: Record<AssetType, Set<string>> = {
  junction: new Set([
    "avgDemand",
    "demandsCount",
    "baseDemand",
    "patternId",
    "customerPointCount",
    "avgCustomerDemand",
  ]),
  pipe: new Set([
    "startNode",
    "endNode",
    "customerDemand",
    "customerPointCount",
  ]),
  pump: new Set(["startNode", "endNode"]),
  valve: new Set(["startNode", "endNode"]),
  reservoir: new Set<string>([]),
  tank: new Set(["minLevel", "maxLevel", "minVolume", "maxVolume"]),
};

export function isAssetComputedKey(type: AssetType, key: string): boolean {
  return key.startsWith("sim_") || ASSET_COMPUTED_KEYS[type].has(key);
}

export function assetAccessor(
  type: AssetType,
  key: string,
  ctx: AssetAccessorCtx,
): (row: AssetRow) => unknown {
  return (row) => {
    const id = row.id;
    if (key.startsWith("sim_")) {
      if (!ctx.simulation) return null;
      const simRow = buildSimRow(type, id, ctx.simulation, ctx.translate);
      return simRow[key] ?? null;
    }
    return computeAssetComputedField(type, key, id, ctx.model);
  };
}

const nodeLabel = (model: HydraulicModel, id: AssetId): string =>
  model.assets.get(id)?.label ?? "";

const sumCustomerAvgDemand = (
  model: HydraulicModel,
  customerPoints: { id: CustomerPointId }[],
): number =>
  customerPoints.reduce(
    (sum, cp) =>
      sum +
      calculateAverageDemand(
        getCustomerPointDemands(model.demands, cp.id),
        model.patterns,
      ),
    0,
  );

function computeAssetComputedField(
  type: AssetType,
  key: string,
  id: AssetId,
  model: HydraulicModel,
): unknown {
  switch (key) {
    case "startNode": {
      const link = model.assets.get(id) as Pipe | Pump | Valve | undefined;
      return link ? nodeLabel(model, link.connections[0]) : "";
    }
    case "endNode": {
      const link = model.assets.get(id) as Pipe | Pump | Valve | undefined;
      return link ? nodeLabel(model, link.connections[1]) : "";
    }
    case "baseDemand":
      return getJunctionDemands(model.demands, id)[0]?.baseDemand ?? 0;
    case "patternId":
      return getJunctionDemands(model.demands, id)[0]?.patternId ?? null;
    case "demandsCount":
      return getJunctionDemands(model.demands, id).length;
    case "avgDemand":
      return calculateAverageDemand(
        getJunctionDemands(model.demands, id),
        model.patterns,
      );
    case "customerPointCount":
      return type === "junction"
        ? getActiveCustomerPoints(model.customerPointsLookup, model.assets, id)
            .length
        : Array.from(model.customerPointsLookup.getCustomerPoints(id)).length;
    case "avgCustomerDemand":
      return sumCustomerAvgDemand(
        model,
        getActiveCustomerPoints(model.customerPointsLookup, model.assets, id),
      );
    case "customerDemand":
      return sumCustomerAvgDemand(
        model,
        Array.from(model.customerPointsLookup.getCustomerPoints(id)),
      );
    case "minLevel":
    case "maxLevel":
    case "minVolume":
    case "maxVolume": {
      const tank = model.assets.get(id) as Tank | undefined;
      if (tank?.volumeCurveId) {
        const curve = model.curves.get(tank.volumeCurveId);
        if (curve && curve.points.length > 0) {
          return tankVolumeCurveRange(curve)[key];
        }
      }
      // No volume curve → the asset's own value.
      return tank ? (tank as unknown as Record<string, unknown>)[key] : null;
    }
    default: {
      const asset = model.assets.get(id);
      return asset ? (asset as unknown as Record<string, unknown>)[key] : null;
    }
  }
}

export function buildAssetModelRows(
  assetType: AssetType,
  hydraulicModel: HydraulicModel,
): AssetRow[] {
  const rows: AssetRow[] = [];
  for (const asset of hydraulicModel.assets.values()) {
    if (asset.type === assetType) rows.push(asset as unknown as AssetRow);
  }
  return rows;
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
        sim_minPressure: sim?.minPressure ?? null,
        sim_maxPressure: sim?.maxPressure ?? null,
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
        sim_head: sim?.head ?? null,
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
        sim_pressure: r?.pressure ?? null,
        sim_minPressure: r?.minPressure ?? null,
        sim_maxPressure: r?.maxPressure ?? null,
        sim_head: r?.head ?? null,
        sim_netFlow: r?.netFlow ?? null,
        ...qualityFields(r),
      };
    }
    case "tank": {
      const sim = simulation.getTank(assetId);
      return {
        sim_pressure: sim?.pressure ?? null,
        sim_minPressure: sim?.minPressure ?? null,
        sim_maxPressure: sim?.maxPressure ?? null,
        sim_head: sim?.head ?? null,
        sim_level: sim?.level ?? null,
        sim_volume: sim?.volume ?? null,
        sim_netFlow: sim?.netFlow ?? null,
        ...qualityFields(sim),
      };
    }
  }
}
