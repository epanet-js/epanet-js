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
import { ModelUnits } from "src/hydraulic-model/units";
import {
  AssetQuantitiesSpec,
  Quantities,
  presets,
} from "src/model-metadata/quantities-spec";

export const buildPipe = (
  data: PipeBuildData = {},
  unitsOverride: Partial<AssetQuantitiesSpec["mappings"]["pipe"]> = {},
) => {
  const quantitiesSpec: AssetQuantitiesSpec = { ...presets.si };
  quantitiesSpec.mappings = {
    ...presets.si.mappings,
    pipe: {
      ...presets.si.mappings.pipe,
      ...unitsOverride,
    },
  };
  const quantities = new Quantities(quantitiesSpec);
  return new AssetBuilder(quantities.units, quantities.defaults).buildPipe(
    data,
  );
};

export const buildJunction = (data: JunctionBuildData = {}) => {
  const quantities = new Quantities(presets.si);
  return new AssetBuilder(quantities.units, quantities.defaults).buildJunction(
    data,
  );
};
export const buildReservoir = (data: ReservoirBuildData = {}) => {
  const quantities = new Quantities(presets.si);
  return new AssetBuilder(quantities.units, quantities.defaults).buildReservoir(
    data,
  );
};

export class HydraulicModelBuilder {
  private topology: Topology;
  private assets: AssetsMap;
  private assetBuilder: AssetBuilder;
  private units: ModelUnits;

  static with(quantitiesSpec: AssetQuantitiesSpec = presets.si) {
    return new HydraulicModelBuilder(quantitiesSpec);
  }

  constructor(quantitiesSpec: AssetQuantitiesSpec = presets.si) {
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

  aJunction(id: string, properties: Partial<JunctionBuildData> = {}) {
    const junction = this.assetBuilder.buildJunction({
      id,
      ...properties,
    });
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
      PipeBuildData & { startNodeId: string; endNodeId: string }
    > = {},
  ) {
    const { startNodeId, endNodeId, ...properties } = data;
    const startNode = this.getNodeOrCreate(startNodeId);
    const endNode = this.getNodeOrCreate(endNodeId);

    const link = this.assetBuilder.buildPipe({
      coordinates: [startNode.coordinates, endNode.coordinates],
      connections: [startNode.id, endNode.id],
      id,
      ...properties,
    });
    this.assets.set(link.id, link);
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
