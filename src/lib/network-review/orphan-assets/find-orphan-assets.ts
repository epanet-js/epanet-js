import { EncodedOrphanAssets, RunData } from "./data";
import {
  FixedSizeBufferView,
  EncodedSize,
  decodeType,
  VariableSizeBufferView,
  decodeIdsList,
  toLinkType,
  decodeLinkConnections,
} from "../shared";

export function findOrphanAssets(input: RunData): EncodedOrphanAssets {
  const linksView = new FixedSizeBufferView<[number, number]>(
    input.linksConnections,
    EncodedSize.id * 2,
    decodeLinkConnections,
  );
  const linkTypesView = new FixedSizeBufferView<number>(
    input.linkTypes,
    EncodedSize.type,
    decodeType,
  );
  const nodeConnectionsView = new VariableSizeBufferView(
    input.nodeConnections,
    decodeIdsList,
  );

  const orphanLinks: number[] = [];
  for (const [id, linkType] of linkTypesView.enumerate()) {
    if (toLinkType(linkType) === "pipe") continue;

    const linkConnections = linksView.getById(id);
    if (!linkConnections) continue;

    const [startNode, endNode] = linkConnections;
    const startNodeConnections = (nodeConnectionsView.getById(startNode) ?? [])
      .length;
    const endNodeConnections = (nodeConnectionsView.getById(endNode) ?? [])
      .length;

    if (startNodeConnections <= 1 && endNodeConnections <= 1) {
      orphanLinks.push(id);
    }
  }

  const orphanNodes: number[] = [];
  for (const [id, connections] of nodeConnectionsView.enumerate()) {
    if (connections.length === 0) orphanNodes.push(id);
  }

  return { orphanNodes, orphanLinks };
}
