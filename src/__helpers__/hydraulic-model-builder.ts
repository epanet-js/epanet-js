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
} from "src/hydraulic-model";
import {
  AssetQuantitiesSpec,
  Quantities,
  UnitsSpec,
  presets,
} from "src/model-metadata/quantities-spec";

export const buildPipe = (
  data: PipeBuildData = {},
  unitsOverride: Partial<UnitsSpec> = {},
) => {
  const quantitiesSpec: AssetQuantitiesSpec = {
    ...presets.lps,
    units: { ...presets.lps.units, ...unitsOverride },
  };
  const quantities = new Quantities(quantitiesSpec);
  return new AssetBuilder(quantities.units, quantities.defaults).buildPipe(
    data,
  );
};

export const buildJunction = (data: JunctionBuildData = {}) => {
  const quantities = new Quantities(presets.lps);
  return new AssetBuilder(quantities.units, quantities.defaults).buildJunction(
    data,
  );
};
export const buildReservoir = (data: ReservoirBuildData = {}) => {
  const quantities = new Quantities(presets.lps);
  return new AssetBuilder(quantities.units, quantities.defaults).buildReservoir(
    data,
  );
};

export class HydraulicModelBuilder {
  private topology: Topology;
  private assets: AssetsMap;
  private assetBuilder: AssetBuilder;
  private units: UnitsSpec;

  static with(quantitiesSpec: AssetQuantitiesSpec = presets.lps) {
    return new HydraulicModelBuilder(quantitiesSpec);
  }

  static empty(): HydraulicModel {
    return HydraulicModelBuilder.with().build();
  }

  constructor(quantitiesSpec: AssetQuantitiesSpec = presets.lps) {
    this.assets = new Map();
    const quantities = new Quantities(quantitiesSpec);
    this.units = quantities.units;
    this.assetBuilder = new AssetBuilder(this.units, quantities.defaults);
    this.topology = new Topology();
  }

  aNode(id: string, coordinates: Position = [0, 0]) {
    const node = this.assetBuilder.buildJunction({ coordinates, id });
    this.assets.set(id, node);
    return this;
  }

  aJunction(
    id: string,
    data: Partial<
      JunctionBuildData & { simulation: Partial<{ pressure: number }> }
    > = {},
  ) {
    const { simulation, ...properties } = data;
    const junction = this.assetBuilder.buildJunction({
      id,
      ...properties,
    });
    if (simulation) {
      junction.setSimulation({ getPressure: () => simulation.pressure || 2 });
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
        simulation: Partial<{ flow: number; velocity: number }>;
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
        getFlow: () => (simulation.flow !== undefined ? simulation.flow : 10),
        getVelocity: () =>
          simulation.velocity !== undefined ? simulation.velocity : 10,
      });
    }
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

  build(): HydraulicModel {
    return {
      version: nanoid(),
      assets: this.assets,
      assetBuilder: this.assetBuilder,
      topology: this.topology,
      units: this.units,
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
