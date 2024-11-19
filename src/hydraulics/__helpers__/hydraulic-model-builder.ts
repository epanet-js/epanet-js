import { Position } from "geojson";
import { PipeAttributes } from "../assets-deprecated";
import { Topology } from "../topology";
import { HydraulicModel } from "../hydraulic-model";
import { AssetsMap, getNode } from "../assets-map";
import { Junction, Pipe } from "../asset-types";

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
    const node = Junction.build({ coordinates, id });
    this.assets.set(id, node);
    return this;
  }

  aLink(
    id: string,
    startNodeId: string,
    endNodeId: string,
    attributes: Partial<PipeAttributes> = {},
  ) {
    const startNode = getNode(this.assets, startNodeId);
    const endNode = getNode(this.assets, endNodeId);
    if (!startNode) throw new Error(`Start node (${startNodeId}) is missing`);
    if (!endNode) throw new Error(`End node (${endNodeId}) is missing`);

    const link = Pipe.build({
      coordinates: [startNode.coordinates, endNode.coordinates],
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
