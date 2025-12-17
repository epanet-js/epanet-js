import { Position } from "geojson";
import { nanoid } from "nanoid";
import {
  PipeProperties,
  HydraulicModel,
  AssetsMap,
  getNode,
  Topology,
  AssetBuilder,
  JunctionBuildData,
  PipeBuildData,
  ReservoirBuildData,
  NodeAsset,
  AssetId,
  HeadlossFormula,
  EPSTiming,
  Controls,
  createEmptyControls,
} from "src/hydraulic-model";
import { AssetIndex } from "src/hydraulic-model/asset-index";
import { CustomerPointsLookup } from "src/hydraulic-model/customer-points-lookup";
import {
  PumpBuildData,
  TankBuildData,
  ValveBuildData,
} from "src/hydraulic-model/asset-builder";
import {
  PumpStatus,
  PumpStatusWarning,
} from "src/hydraulic-model/asset-types/pump";
import { PipeSimulation } from "src/hydraulic-model/asset-types/pipe";
import {
  ConsecutiveIdsGenerator,
  IdGenerator,
} from "src/hydraulic-model/id-generator";
import { LabelManager } from "src/hydraulic-model/label-manager";
import {
  AssetQuantitiesSpec,
  Quantities,
  UnitsSpec,
  presets,
} from "src/model-metadata/quantities-spec";
import { ValveSimulation } from "src/hydraulic-model/asset-types/valve";
import { Demands, createEmptyDemands } from "src/hydraulic-model/demands";
import {
  AllocationRule,
  CustomerPoint,
  CustomerPoints,
  initializeCustomerPoints,
} from "src/hydraulic-model/customer-points";
import { Curves, ICurve } from "src/hydraulic-model/curves";

export const buildPipe = (
  data: PipeBuildData = {},
  unitsOverride: Partial<UnitsSpec> = {},
) => {
  const quantitiesSpec: AssetQuantitiesSpec = {
    ...presets.LPS,
    units: { ...presets.LPS.units, ...unitsOverride },
  };
  const quantities = new Quantities(quantitiesSpec);
  return new AssetBuilder(
    quantities.units,
    quantities.defaults,
    new ConsecutiveIdsGenerator(),
    new LabelManager(),
  ).buildPipe(data);
};
export const buildPump = (
  data: PumpBuildData = {},
  unitsOverride: Partial<UnitsSpec> = {},
) => {
  const quantitiesSpec: AssetQuantitiesSpec = {
    ...presets.LPS,
    units: { ...presets.LPS.units, ...unitsOverride },
  };
  const quantities = new Quantities(quantitiesSpec);
  return new AssetBuilder(
    quantities.units,
    quantities.defaults,
    new ConsecutiveIdsGenerator(),
    new LabelManager(),
  ).buildPump(data);
};

export const buildJunction = (data: JunctionBuildData = {}) => {
  const quantities = new Quantities(presets.LPS);
  return new AssetBuilder(
    quantities.units,
    quantities.defaults,
    new ConsecutiveIdsGenerator(),
    new LabelManager(),
  ).buildJunction(data);
};
export const buildReservoir = (data: ReservoirBuildData = {}) => {
  const quantities = new Quantities(presets.LPS);
  return new AssetBuilder(
    quantities.units,
    quantities.defaults,
    new ConsecutiveIdsGenerator(),
    new LabelManager(),
  ).buildReservoir(data);
};

export const buildCustomerPoint = (
  id: number,
  options: {
    demand?: number;
    coordinates?: Position;
    junctionId?: number;
    label?: string;
  } = {},
) => {
  const { demand = 0, coordinates = [0, 0], label = String(id) } = options;
  return CustomerPoint.build(id, coordinates, {
    baseDemand: demand,
    label,
  });
};

class WritableIdGenerator implements IdGenerator {
  private last: number;
  constructor() {
    this.last = 0;
  }

  newId(): number {
    this.last = this.last + 1;
    return this.last;
  }

  get totalGenerated(): number {
    return this.last;
  }

  addId(id: number) {
    if (id > this.last) this.last = id;
  }
}

export class HydraulicModelBuilder {
  private topology: Topology;
  private assets: AssetsMap;
  private assetBuilder: AssetBuilder;
  private units: UnitsSpec;
  private headlossFormulaValue: HeadlossFormula;
  private labelManager: LabelManager;
  private demands: Demands;
  private customerPointsMap: CustomerPoints;
  private idGenerator: WritableIdGenerator;
  private curves: Curves;
  private epsTiming: EPSTiming;
  private controlsValue: Controls;

  static with(quantitiesSpec: AssetQuantitiesSpec = presets.LPS) {
    return new HydraulicModelBuilder(quantitiesSpec);
  }

  static empty(): HydraulicModel {
    return HydraulicModelBuilder.with().build();
  }

  constructor(quantitiesSpec: AssetQuantitiesSpec = presets.LPS) {
    this.assets = new Map();
    this.customerPointsMap = initializeCustomerPoints();
    this.labelManager = new LabelManager();
    this.idGenerator = new WritableIdGenerator();
    const quantities = new Quantities(quantitiesSpec);
    this.units = quantities.units;
    this.assetBuilder = new AssetBuilder(
      this.units,
      quantities.defaults,
      this.idGenerator,
      this.labelManager,
    );
    this.topology = new Topology();
    this.demands = createEmptyDemands();
    this.headlossFormulaValue = "H-W";
    this.curves = new Map();
    this.epsTiming = {};
    this.controlsValue = createEmptyControls();
  }

  aNode(id: number, coordinates: Position = [0, 0]) {
    const node = this.assetBuilder.buildJunction({
      coordinates,
      id,
    });
    this.assets.set(id, node);
    this.idGenerator.addId(id);
    return this;
  }

  aJunction(
    id: number,
    data: Partial<
      JunctionBuildData & {
        simulation: Partial<{ pressure: number; head: number; demand: number }>;
      }
    > = {},
  ) {
    const { simulation, baseDemand, ...properties } = data;
    const demands =
      properties.demands ?? (baseDemand ? [{ baseDemand }] : undefined);
    const junction = this.assetBuilder.buildJunction({
      id,
      ...properties,
      baseDemand,
      demands,
    });
    if (simulation) {
      junction.setSimulation({
        pressure: 2,
        head: 4,
        demand: 10,
        ...simulation,
      });
    }
    this.assets.set(id, junction);
    this.idGenerator.addId(id);
    return this;
  }

  aReservoir(id: number, properties: Partial<ReservoirBuildData> = {}) {
    const reservoir = this.assetBuilder.buildReservoir({
      id,
      ...properties,
    });
    this.assets.set(id, reservoir);
    this.idGenerator.addId(id);
    return this;
  }

  aTank(
    id: number,
    data: Partial<
      TankBuildData & {
        simulation: Partial<{
          pressure: number;
          head: number;
          level: number;
          volume: number;
        }>;
      }
    > = {},
  ) {
    const { simulation, ...properties } = data;
    const tank = this.assetBuilder.buildTank({
      id,
      ...properties,
    });
    if (simulation) {
      tank.setSimulation({
        pressure: 15,
        head: 125,
        level: 25,
        volume: 1500,
        ...simulation,
      });
    }
    this.assets.set(id, tank);
    this.idGenerator.addId(id);
    return this;
  }

  aPipe(
    id: number,
    data: Partial<
      PipeBuildData & {
        startNodeId: number;
        endNodeId: number;
      } & {
        simulation: Partial<PipeSimulation>;
      }
    > = {},
  ) {
    const { startNodeId, endNodeId, simulation, coordinates, ...properties } =
      data;
    const startNode = this.getNodeOrCreate(startNodeId);
    const endNode = this.getNodeOrCreate(endNodeId);

    const pipe = this.assetBuilder.buildPipe({
      coordinates: coordinates || [startNode.coordinates, endNode.coordinates],
      connections: [startNode.id, endNode.id],
      id,
      ...properties,
    });
    this.assets.set(id, pipe);
    if (simulation) {
      pipe.setSimulation({
        flow: 10,
        velocity: 10,
        headloss: 10,
        unitHeadloss: 10,
        status: "open",
        ...simulation,
      });
    }
    this.idGenerator.addId(id);
    this.topology.addLink(id, startNode.id, endNode.id);
    return this;
  }

  aPump(
    id: number,
    data: Partial<
      PumpBuildData & {
        startNodeId: number;
        endNodeId: number;
      } & {
        simulation: Partial<{
          flow: number;
          headloss: number;
          status: PumpStatus;
          statusWarning: PumpStatusWarning;
        }>;
      }
    > = {},
  ) {
    const { startNodeId, endNodeId, simulation, ...properties } = data;
    const startNode = this.getNodeOrCreate(startNodeId);
    const endNode = this.getNodeOrCreate(endNodeId);

    const pump = this.assetBuilder.buildPump({
      coordinates: [startNode.coordinates, endNode.coordinates],
      connections: [startNode.id, endNode.id],
      id,
      ...properties,
    });
    if (simulation) {
      pump.setSimulation({
        flow: 10,
        headloss: 10,
        status: "on",
        statusWarning: null,
        ...simulation,
      });
    }
    this.assets.set(id, pump);
    this.idGenerator.addId(id);
    this.topology.addLink(id, startNode.id, endNode.id);
    return this;
  }

  aValve(
    id: number,
    data: Partial<
      ValveBuildData & {
        startNodeId: number;
        endNodeId: number;
      } & {
        simulation: Partial<ValveSimulation>;
      }
    > = {},
  ) {
    const { startNodeId, endNodeId, simulation, ...properties } = data;
    const startNode = this.getNodeOrCreate(startNodeId);
    const endNode = this.getNodeOrCreate(endNodeId);

    const valve = this.assetBuilder.buildValve({
      coordinates: [startNode.coordinates, endNode.coordinates],
      connections: [startNode.id, endNode.id],
      id,
      ...properties,
    });
    if (simulation) {
      valve.setSimulation({
        flow: 10,
        headloss: 10,
        velocity: 10,
        status: "active",
        statusWarning: null,
        ...simulation,
      });
    }
    this.assets.set(id, valve);
    this.idGenerator.addId(id);
    this.topology.addLink(id, startNode.id, endNode.id);
    return this;
  }

  aLink(
    id: number,
    startNodeId: number,
    endNodeId: number,
    properties: Partial<PipeProperties> = {},
  ) {
    return this.aPipe(id, { startNodeId, endNodeId, ...properties });
  }

  headlossFormula(headlossFormula: HeadlossFormula) {
    this.headlossFormulaValue = headlossFormula;
    return this;
  }

  demandMultiplier(multiplier: number) {
    this.demands = { multiplier, patterns: this.demands.patterns };
    return this;
  }

  aDemandPattern(patternId: string, factors: number[]) {
    this.demands.patterns.set(patternId, factors);
    return this;
  }

  aCustomerPoint(
    id: number,
    options: {
      demand?: number;
      coordinates?: Position;
      label?: string;
      connection?: {
        pipeId: number;
        junctionId: number;
        snapPoint?: Position;
      };
    } = {},
  ) {
    const { connection, ...customerPointOptions } = options;
    const customerPoint = buildCustomerPoint(id, customerPointOptions);

    if (connection) {
      const { pipeId, junctionId, snapPoint } = connection;

      const pipe = this.assets.get(pipeId);
      if (!pipe || pipe.type !== "pipe") {
        throw new Error(
          `Pipe ${pipeId} must be created before connecting customer point ${id}`,
        );
      }

      const junction = this.assets.get(junctionId);
      if (!junction || junction.type !== "junction") {
        throw new Error(
          `Junction ${junctionId} must be created before connecting customer point ${id}`,
        );
      }

      const defaultSnapPoint = snapPoint || customerPoint.coordinates;

      customerPoint.connect({
        pipeId,
        snapPoint: defaultSnapPoint,
        junctionId,
      });
    }

    this.customerPointsMap.set(id, customerPoint);
    return this;
  }

  aPumpCurve(curve: Omit<ICurve, "type">) {
    this.curves.set(curve.id, { ...curve, type: "pump" });
    return this;
  }

  eps(epsTiming: EPSTiming) {
    this.epsTiming = epsTiming;
    return this;
  }

  controls(controls: Controls) {
    this.controlsValue = controls;
    return this;
  }

  build(): HydraulicModel {
    const lookup = new CustomerPointsLookup();

    for (const customerPoint of this.customerPointsMap.values()) {
      if (customerPoint.connection) {
        lookup.addConnection(customerPoint);
      }
    }

    const assetIndex = new AssetIndex(this.idGenerator, this.assets);
    for (const asset of this.assets.values()) {
      if (asset.isLink) {
        assetIndex.addLink(asset.id);
      } else if (asset.isNode) {
        assetIndex.addNode(asset.id);
      }
    }

    return {
      version: nanoid(),
      assets: this.assets,
      customerPoints: this.customerPointsMap,
      customerPointsLookup: lookup,
      assetBuilder: this.assetBuilder,
      labelManager: this.labelManager,
      topology: this.topology,
      assetIndex,
      units: this.units,
      demands: this.demands,
      headlossFormula: this.headlossFormulaValue,
      curves: this.curves,
      epsTiming: this.epsTiming,
      controls: this.controlsValue,
    };
  }

  private getNodeOrCreate(nodeId: AssetId | undefined): NodeAsset {
    let node: NodeAsset | null;
    if (!nodeId) {
      node = this.assetBuilder.buildJunction();
    } else {
      node = getNode(this.assets, nodeId);
      if (!node) throw new Error(`Node provided missing in assets (${nodeId})`);
    }
    return node;
  }
}

export const anAllocationRule = (
  overrides: Partial<AllocationRule> = {},
): AllocationRule => ({
  maxDistance: 10,
  maxDiameter: 200,
  ...overrides,
});
