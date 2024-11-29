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

  aNode(id: string, coordinates: Position) {
    const node = this.assetBuilder.buildJunction({ coordinates, id });
    this.assets.set(id, node);
    return this;
  }

  aLink(
    id: string,
    startNodeId: string,
    endNodeId: string,
    attributes: Partial<PipeProperties> = {},
  ) {
    const startNode = getNode(this.assets, startNodeId);
    const endNode = getNode(this.assets, endNodeId);
    if (!startNode) throw new Error(`Start node (${startNodeId}) is missing`);
    if (!endNode) throw new Error(`End node (${endNodeId}) is missing`);

    const link = this.assetBuilder.buildPipe({
      coordinates: [startNode.coordinates, endNode.coordinates],
      id,
      ...attributes,
    });
    this.assets.set(link.id, link);
    this.topology.addLink(id, startNodeId, endNodeId);

    return this;
  }

  build(): HydraulicModel {
    return {
      assets: this.assets,
      assetBuilder: this.assetBuilder,
      topology: this.topology,
    };
  }
}
