import {
  type Junction,
  type Pipe,
  type Pump,
  type Valve,
  type Reservoir,
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
import type { TranslateFn } from "src/hooks/use-translate";
import { ResultsReader } from "src/simulation";

export type AssetRow = Record<string, unknown> & { id: AssetId };

/**
 * Context captured by the lazy asset accessors (flag path). The model snapshot
 * is read on demand inside `accessorFn`, so the column defs must be rebuilt when
 * any of these change.
 */
export type AssetAccessorCtx = {
  model: HydraulicModel;
  simulation: ResultsReader | null;
  translate: TranslateFn;
};

// Columns whose value is NOT a direct attribute of the asset object and must be
// computed from the model/simulation. Everything else is read straight off the
// model object via `accessorKey` (a prototype getter). `sim_*` columns are always
// computed and handled separately.
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

/**
 * Returns an `accessorFn` that lazily computes a single computed column for a
 * model-object row. Only invoked for rendered rows (and the sorted column), so
 * the heavy per-cell work is no longer paid eagerly for every row.
 */
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
    const computed = buildComputedFields(type, id, ctx.model);
    if (key in computed) return computed[key];
    // Tank level/volume columns fall back to the asset's own value when there
    // is no volume curve (buildComputedFields returns {} in that case).
    const asset = ctx.model.assets.get(id);
    return asset ? (asset as unknown as Record<string, unknown>)[key] : null;
  };
}

/**
 * Flag path: the grid rows ARE the model objects (no flat-row allocation or
 * computation). Cast to AssetRow so the existing column/grid types apply; values
 * are read lazily via `accessorKey` getters / computed `accessorFn`s.
 */
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

const CHUNK_SIZE = 200;

function yieldToMain(): Promise<void> {
  const scheduler = (globalThis as Record<string, unknown>)["scheduler"] as
    | {
        postTask?: (
          cb: () => void,
          opts: { priority: string },
        ) => Promise<void>;
      }
    | undefined;
  if (scheduler?.postTask) {
    return scheduler.postTask(() => {}, { priority: "user-visible" });
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function buildRow(
  assetType: AssetType,
  id: AssetId,
  hydraulicModel: HydraulicModel,
  simulation: ResultsReader | null,
  translate: TranslateFn,
): AssetRow | null {
  const asset = hydraulicModel.assets.get(id);
  if (!asset) return null;
  return {
    ...buildAssetRow(assetType, asset),
    ...(simulation ? buildSimRow(assetType, id, simulation, translate) : {}),
    ...buildComputedFields(assetType, id, hydraulicModel),
  };
}

export async function buildRowsAsync(
  assetType: AssetType,
  assetIds: AssetId[],
  hydraulicModel: HydraulicModel,
  simulation: ResultsReader | null,
  translate: TranslateFn,
  signal?: AbortSignal,
): Promise<AssetRow[]> {
  const result: AssetRow[] = [];
  for (
    let chunkStart = 0;
    chunkStart < assetIds.length;
    chunkStart += CHUNK_SIZE
  ) {
    if (chunkStart > 0) await yieldToMain();
    if (signal?.aborted) return result;
    for (
      let rowIndex = chunkStart;
      rowIndex < Math.min(chunkStart + CHUNK_SIZE, assetIds.length);
      rowIndex++
    ) {
      const row = buildRow(
        assetType,
        assetIds[rowIndex],
        hydraulicModel,
        simulation,
        translate,
      );
      if (row) result.push(row);
    }
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

function resolveConnectionLabels(
  assetId: AssetId,
  hydraulicModel: HydraulicModel,
) {
  const link = hydraulicModel.assets.get(assetId) as Pipe | Pump | Valve;
  const [startNodeId, endNodeId] = link.connections;
  return {
    startNode: hydraulicModel.assets.get(startNodeId)?.label ?? "",
    endNode: hydraulicModel.assets.get(endNodeId)?.label ?? "",
  };
}

function buildComputedFields(
  assetType: AssetType,
  assetId: AssetId,
  hydraulicModel: HydraulicModel,
): Record<string, unknown> {
  if (assetType === "junction") {
    const junctionDemands = getJunctionDemands(hydraulicModel.demands, assetId);
    const firstDemand = junctionDemands[0];
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
      baseDemand: firstDemand?.baseDemand ?? 0,
      patternId: firstDemand?.patternId ?? null,
      demandsCount: junctionDemands.length,
      avgDemand,
      avgCustomerDemand,
      customerPointCount: customerPoints.length,
    };
  }

  if (assetType === "tank") {
    const tank = hydraulicModel.assets.get(assetId) as Tank;
    if (tank.volumeCurveId) {
      const curve = hydraulicModel.curves.get(tank.volumeCurveId);
      if (curve && curve.points.length > 0) {
        const { minLevel, maxLevel, minVolume, maxVolume } =
          tankVolumeCurveRange(curve);
        return { minLevel, maxLevel, minVolume, maxVolume };
      }
    }
    return {};
  }

  if (assetType === "pump") {
    return resolveConnectionLabels(assetId, hydraulicModel);
  }

  if (assetType === "valve") {
    return resolveConnectionLabels(assetId, hydraulicModel);
  }

  if (assetType === "pipe") {
    const customerPoints = Array.from(
      hydraulicModel.customerPointsLookup.getCustomerPoints(assetId),
    );
    const customerDemand = customerPoints.reduce(
      (sum, cp) =>
        sum +
        calculateAverageDemand(
          getCustomerPointDemands(hydraulicModel.demands, cp.id),
          hydraulicModel.patterns,
        ),
      0,
    );
    return {
      ...resolveConnectionLabels(assetId, hydraulicModel),
      customerDemand,
      customerPointCount: customerPoints.length,
    };
  }

  return {};
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
        material: a.material,
        year: a.year,
      };
    }
    case "pump": {
      const a = asset as Pump;
      return {
        ...base,
        definitionType: a.definitionType,
        initialStatus: a.initialStatus,
        speed: a.speed,
        power: a.power,
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
        maxVolume: a.maxVolume,
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
