import { Position } from "geojson";
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
} from "src/hydraulic-model";

export const buildPipe = (data: PipeBuildData = {}) =>
  new AssetBuilder().buildPipe(data);
export const buildJunction = (data: JunctionBuildData = {}) =>
  new AssetBuilder().buildJunction(data);
export const buildReservoir = (data: ReservoirBuildData = {}) =>
  new AssetBuilder().buildReservoir(data);

export class HydraulicModelBuilder {
  private topology: Topology;
  private assets: AssetsMap;
  private assetBuilder: AssetBuilder;

  static with() {
    return new HydraulicModelBuilder();
  }

  constructor() {
    this.assets = new Map();
    this.assetBuilder = new AssetBuilder();
    this.topology = new Topology();
  }

  aNode(id: string, coordinates: Position = [0, 0]) {
    const node = this.assetBuilder.buildJunction({ coordinates, id });
    this.assets.set(id, node);
    return this;
  }

  aJunction(id: string, properties: Partial<JunctionBuildData>) {
    const junction = this.assetBuilder.buildJunction({
      id,
      ...properties,
    });
    this.assets.set(id, junction);
    return this;
  }

  aReservoir(id: string, properties: Partial<ReservoirBuildData>) {
    const reservoir = this.assetBuilder.buildReservoir({
      id,
      ...properties,
    });
    this.assets.set(id, reservoir);
    return this;
  }

  aPipe(
    id: string,
    startNodeId: string,
    endNodeId: string,
    properties: Partial<PipeBuildData>,
  ) {
    const startNode = getNode(this.assets, startNodeId);
    const endNode = getNode(this.assets, endNodeId);
    if (!startNode) throw new Error(`Start node (${startNodeId}) is missing`);
    if (!endNode) throw new Error(`End node (${endNodeId}) is missing`);

    const link = this.assetBuilder.buildPipe({
      coordinates: [startNode.coordinates, endNode.coordinates],
      connections: [startNode.id, endNode.id],
      id,
      ...properties,
    });
    this.assets.set(link.id, link);
    this.topology.addLink(id, startNodeId, endNodeId);

    return this;
  }

  aLink(
    id: string,
    startNodeId: string,
    endNodeId: string,
    properties: Partial<PipeProperties> = {},
  ) {
    return this.aPipe(id, startNodeId, endNodeId, properties);
  }

  build(): HydraulicModel {
    return {
      assets: this.assets,
      assetBuilder: this.assetBuilder,
      topology: this.topology,
    };
  }
}
