import { EncodedOrphanAssets } from "./data";
import {
  HydraulicModelBuffers,
  HydraulicModelBuffersView,
  toLinkType,
} from "../shared";

export function findOrphanAssets(
  buffers: HydraulicModelBuffers,
): EncodedOrphanAssets {
  const views = new HydraulicModelBuffersView(buffers);

  const orphanLinks: number[] = [];
  for (const [id, linkType] of views.linkTypes.enumerate()) {
    if (toLinkType(linkType) === "pipe") continue;

    const [startNode, endNode] = views.linksConnections.getById(id);

    const startNodeConnections =
      views.nodeConnections.getById(startNode).length;
    const endNodeConnections = views.nodeConnections.getById(endNode).length;

    if (startNodeConnections <= 1 && endNodeConnections <= 1) {
      orphanLinks.push(id);
    }
  }

  const orphanNodes: number[] = [];
  for (const [id, connections] of views.nodeConnections.enumerate()) {
    if (connections.length === 0) orphanNodes.push(id);
  }

  return { orphanNodes, orphanLinks };
}
