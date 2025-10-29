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
} from "src/hydraulic-model";
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
import { IdGenerator } from "src/hydraulic-model/id-generator";
import { LabelManager } from "src/hydraulic-model/label-manager";
import {
  AssetQuantitiesSpec,
  Quantities,
  UnitsSpec,
  presets,
} from "src/model-metadata/quantities-spec";
import { ValveSimulation } from "src/hydraulic-model/asset-types/valve";
import { Demands, nullDemands } from "src/hydraulic-model/demands";
import {
  AllocationRule,
  CustomerPoint,
  CustomerPoints,
  initializeCustomerPoints,
} from "src/hydraulic-model/customer-points";

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
    new IdGenerator(),
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
    new IdGenerator(),
    new LabelManager(),
  ).buildPump(data);
};

export const buildJunction = (data: JunctionBuildData = {}) => {
  const quantities = new Quantities(presets.LPS);
  return new AssetBuilder(
    quantities.units,
    quantities.defaults,
    new IdGenerator(),
    new LabelManager(),
  ).buildJunction(data);
};
export const buildReservoir = (data: ReservoirBuildData = {}) => {
  const quantities = new Quantities(presets.LPS);
  return new AssetBuilder(
    quantities.units,
    quantities.defaults,
    new IdGenerator(),
    new LabelManager(),
  ).buildReservoir(data);
};

export const buildCustomerPoint = (
  id: string,
  options: {
    demand?: number;
    coordinates?: Position;
    junctionId?: string;
    label?: string;
  } = {},
) => {
  const { demand = 0, coordinates = [0, 0], label = id } = options;
  return CustomerPoint.build(id, coordinates, { baseDemand: demand, label });
};

export class HydraulicModelBuilder {
  private topology: Topology;
  private assets: AssetsMap;
  private assetBuilder: AssetBuilder;
  private units: UnitsSpec;
  private headlossFormulaValue: HeadlossFormula;
  private labelManager: LabelManager;
  private demands: Demands;
  private customerPointsMap: CustomerPoints;

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
    const quantities = new Quantities(quantitiesSpec);
    this.units = quantities.units;
    this.assetBuilder = new AssetBuilder(
      this.units,
      quantities.defaults,
      new IdGenerator(),
      this.labelManager,
    );
    this.topology = new Topology();
    this.demands = nullDemands;
    this.headlossFormulaValue = "H-W";
  }

  aNode(id: string | number, coordinates: Position = [0, 0]) {
    const numericId = typeof id === "number" ? id : undefined;
    const stringId = typeof id === "string" ? id : String(id);
    const node = this.assetBuilder.buildJunction({
      coordinates,
      id: numericId ?? stringId,
    });
    this.assets.set(stringId, node);
    return this;
  }

  aJunction(
    id: string | number,
    data: Partial<
      JunctionBuildData & {
        simulation: Partial<{ pressure: number; head: number; demand: number }>;
      }
    > = {},
  ) {
    const numericId = typeof id === "number" ? id : undefined;
    const stringId = typeof id === "string" ? id : String(id);
    const { simulation, ...properties } = data;
    const junction = this.assetBuilder.buildJunction({
      id: numericId ?? stringId,
      ...properties,
    });
    if (simulation) {
      junction.setSimulation({
        pressure: 2,
        head: 4,
        demand: 10,
        ...simulation,
      });
    }
    this.assets.set(stringId, junction);
    return this;
  }

  aReservoir(
    id: string | number,
    properties: Partial<ReservoirBuildData> = {},
  ) {
    const numericId = typeof id === "number" ? id : undefined;
    const stringId = typeof id === "string" ? id : String(id);
    const reservoir = this.assetBuilder.buildReservoir({
      id: numericId ?? stringId,
      ...properties,
    });
    this.assets.set(stringId, reservoir);
    return this;
  }

  aTank(
    id: string | number,
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
    const numericId = typeof id === "number" ? id : undefined;
    const stringId = typeof id === "string" ? id : String(id);
    const { simulation, ...properties } = data;
    const tank = this.assetBuilder.buildTank({
      id: numericId ?? stringId,
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
    this.assets.set(stringId, tank);
    return this;
  }

  aPipe(
    id: string | number,
    data: Partial<
      PipeBuildData & {
        startNodeId: string | number;
        endNodeId: string | number;
      } & {
        simulation: Partial<PipeSimulation>;
      }
    > = {},
  ) {
    const numericId = typeof id === "number" ? id : undefined;
    const stringId = typeof id === "string" ? id : String(id);
    const { startNodeId, endNodeId, simulation, ...properties } = data;
    const startNode = this.getNodeOrCreate(startNodeId);
    const endNode = this.getNodeOrCreate(endNodeId);

    const pipe = this.assetBuilder.buildPipe({
      coordinates: [startNode.coordinates, endNode.coordinates],
      connections: [startNode.id, endNode.id],
      id: numericId ?? stringId,
      ...properties,
    });
    this.assets.set(stringId, pipe);
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
    this.topology.addLink(stringId, startNode.id, endNode.id);

    return this;
  }

  aPump(
    id: string | number,
    data: Partial<
      PumpBuildData & {
        startNodeId: string | number;
        endNodeId: string | number;
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
    const numericId = typeof id === "number" ? id : undefined;
    const stringId = typeof id === "string" ? id : String(id);
    const { startNodeId, endNodeId, simulation, ...properties } = data;
    const startNode = this.getNodeOrCreate(startNodeId);
    const endNode = this.getNodeOrCreate(endNodeId);

    const pump = this.assetBuilder.buildPump({
      coordinates: [startNode.coordinates, endNode.coordinates],
      connections: [startNode.id, endNode.id],
      id: numericId ?? stringId,
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
    this.assets.set(stringId, pump);
    this.topology.addLink(stringId, startNode.id, endNode.id);

    return this;
  }

  aValve(
    id: string | number,
    data: Partial<
      ValveBuildData & {
        startNodeId: string | number;
        endNodeId: string | number;
      } & {
        simulation: Partial<ValveSimulation>;
      }
    > = {},
  ) {
    const numericId = typeof id === "number" ? id : undefined;
    const stringId = typeof id === "string" ? id : String(id);
    const { startNodeId, endNodeId, simulation, ...properties } = data;
    const startNode = this.getNodeOrCreate(startNodeId);
    const endNode = this.getNodeOrCreate(endNodeId);

    const valve = this.assetBuilder.buildValve({
      coordinates: [startNode.coordinates, endNode.coordinates],
      connections: [startNode.id, endNode.id],
      id: numericId ?? stringId,
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
    this.assets.set(stringId, valve);
    this.topology.addLink(stringId, startNode.id, endNode.id);

    return this;
  }

  aLink(
    id: string | number,
    startNodeId: string | number,
    endNodeId: string | number,
    properties: Partial<PipeProperties> = {},
  ) {
    return this.aPipe(id, { startNodeId, endNodeId, ...properties });
  }

  headlossFormula(headlossFormula: HeadlossFormula) {
    this.headlossFormulaValue = headlossFormula;
    return this;
  }

  demandMultiplier(multiplier: number) {
    this.demands = { multiplier };
    return this;
  }

  aCustomerPoint(
    id: string,
    options: {
      demand?: number;
      coordinates?: Position;
      connection?: {
        pipeId: string;
        junctionId: string;
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

  build(): HydraulicModel {
    const lookup = new CustomerPointsLookup();

    for (const customerPoint of this.customerPointsMap.values()) {
      if (customerPoint.connection) {
        lookup.addConnection(customerPoint);
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
      units: this.units,
      demands: this.demands,
      headlossFormula: this.headlossFormulaValue,
    };
  }

  private getNodeOrCreate(nodeId: AssetId | number | undefined): NodeAsset {
    let node: NodeAsset | null;
    if (!nodeId) {
      node = this.assetBuilder.buildJunction();
    } else {
      const stringId = typeof nodeId === "string" ? nodeId : String(nodeId);
      node = getNode(this.assets, stringId);
      if (!node)
        throw new Error(`Node provided missing in assets (${stringId})`);
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
