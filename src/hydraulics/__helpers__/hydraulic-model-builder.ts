import { Position } from "geojson";
import {
  AssetsMap,
  NodeAsset,
  PipeAttributes,
  createJunction,
  createPipe,
  getNodeCoordinates,
} from "../assets-deprecated";
import { Topology } from "../topology";
import { HydraulicModel } from "../hydraulic-model";

export class HydraulicModelBuilder {
  private topology: Topology;
  private assets: AssetsMap;

  static with() {
    return new HydraulicModelBuilder();
  }

  constructor() {
    this.assets = new Map();
    this.topology = new Topology();
  }

  aNode(id: string, coordinates: Position) {
    const node = createJunction({ coordinates, id });
    this.assets.set(id, node);
    return this;
  }

  aLink(
    id: string,
    startNodeId: string,
    endNodeId: string,
    attributes: Partial<PipeAttributes> = {},
  ) {
    const startNode = this.assets.get(startNodeId);
    const endNode = this.assets.get(endNodeId);
    if (!startNode) throw new Error(`Start node (${startNodeId}) is missing`);
    if (!endNode) throw new Error(`End node (${endNodeId}) is missing`);

    const link = createPipe({
      coordinates: [
        getNodeCoordinates(startNode as NodeAsset),
        getNodeCoordinates(endNode as NodeAsset),
      ],
      id,
      ...attributes,
    });
    this.assets.set(link.id, link);
    this.topology.addLink(id, startNodeId, endNodeId);

    return this;
  }

  build(): HydraulicModel {
    return { assets: this.assets, topology: this.topology };
  }
}
