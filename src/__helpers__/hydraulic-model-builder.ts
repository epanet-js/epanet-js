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
import {
  PumpBuildData,
  ValveBuildData,
} from "src/hydraulic-model/asset-builder";
import {
  PumpStatus,
  PumpStatusWarning,
} from "src/hydraulic-model/asset-types/pump";
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

export class HydraulicModelBuilder {
  private topology: Topology;
  private assets: AssetsMap;
  private assetBuilder: AssetBuilder;
  private units: UnitsSpec;
  private headlossFormulaValue: HeadlossFormula;
  private labelManager: LabelManager;
  private demands: Demands;

  static with(quantitiesSpec: AssetQuantitiesSpec = presets.LPS) {
    return new HydraulicModelBuilder(quantitiesSpec);
  }

  static empty(): HydraulicModel {
    return HydraulicModelBuilder.with().build();
  }

  constructor(quantitiesSpec: AssetQuantitiesSpec = presets.LPS) {
    this.assets = new Map();
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

  aNode(id: string, coordinates: Position = [0, 0]) {
    const node = this.assetBuilder.buildJunction({ coordinates, id });
    this.assets.set(id, node);
    return this;
  }

  aJunction(
    id: string,
    data: Partial<
      JunctionBuildData & {
        simulation: Partial<{ pressure: number; head: number; demand: number }>;
      }
    > = {},
  ) {
    const { simulation, ...properties } = data;
    const junction = this.assetBuilder.buildJunction({
      id,
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
    this.assets.set(id, junction);
    return this;
  }

  aReservoir(id: string, properties: Partial<ReservoirBuildData> = {}) {
    const reservoir = this.assetBuilder.buildReservoir({
      id,
      ...properties,
    });
    this.assets.set(id, reservoir);
    return this;
  }

  aPipe(
    id: string,
    data: Partial<
      PipeBuildData & { startNodeId: string; endNodeId: string } & {
        simulation: Partial<{
          flow: number;
          velocity: number;
          headloss: number;
          unitHeadloss: number;
        }>;
      }
    > = {},
  ) {
    const { startNodeId, endNodeId, simulation, ...properties } = data;
    const startNode = this.getNodeOrCreate(startNodeId);
    const endNode = this.getNodeOrCreate(endNodeId);

    const pipe = this.assetBuilder.buildPipe({
      coordinates: [startNode.coordinates, endNode.coordinates],
      connections: [startNode.id, endNode.id],
      id,
      ...properties,
    });
    this.assets.set(pipe.id, pipe);
    if (simulation) {
      pipe.setSimulation({
        flow: 10,
        velocity: 10,
        headloss: 10,
        unitHeadloss: 10,
        ...simulation,
      });
    }
    this.topology.addLink(id, startNode.id, endNode.id);

    return this;
  }

  aPump(
    id: string,
    data: Partial<
      PumpBuildData & { startNodeId: string; endNodeId: string } & {
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
    this.assets.set(pump.id, pump);
    this.topology.addLink(id, startNode.id, endNode.id);

    return this;
  }

  aValve(
    id: string,
    data: Partial<
      ValveBuildData & { startNodeId: string; endNodeId: string } & {
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
    this.assets.set(valve.id, valve);
    this.topology.addLink(id, startNode.id, endNode.id);

    return this;
  }

  aLink(
    id: string,
    startNodeId: string,
    endNodeId: string,
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

  build(): HydraulicModel {
    return {
      version: nanoid(),
      assets: this.assets,
      assetBuilder: this.assetBuilder,
      labelManager: this.labelManager,
      topology: this.topology,
      units: this.units,
      demands: this.demands,
      headlossFormula: this.headlossFormulaValue,
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
