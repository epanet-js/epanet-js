import { RunData, EncodedSubNetworks } from "./data";
import {
  FixedSizeBufferView,
  EncodedSize,
  decodeId,
  decodeType,
  decodeBounds,
  VariableSizeBufferView,
  toNodeType,
  decodeIdsList,
} from "../shared";

export function findSubNetworks(input: RunData): EncodedSubNetworks {
  const linksView = new FixedSizeBufferView<{
    startNode: number;
    endNode: number;
  }>(input.linksConnections, EncodedSize.id * 2, (offset, view) => ({
    startNode: decodeId(offset, view),
    endNode: decodeId(offset + EncodedSize.id, view),
  }));
  const nodesConnectionsView = new VariableSizeBufferView(
    input.nodesConnections,
    decodeIdsList,
  );
  const nodeTypesView = new FixedSizeBufferView<number>(
    input.nodeTypes,
    EncodedSize.type,
    decodeType,
  );
  const linkTypesView = new FixedSizeBufferView<number>(
    input.linkTypes,
    EncodedSize.type,
    decodeType,
  );
  const linkBoundsView = new FixedSizeBufferView<
    [number, number, number, number]
  >(input.linkBounds, EncodedSize.bounds, decodeBounds);

  const visited = new Set<number>();
  const components: EncodedSubNetworks["subnetworks"] = [];
  let subnetworkId = 0;

  for (const [nodeId] of nodesConnectionsView.enumerate()) {
    if (visited.has(nodeId)) continue;

    const component = {
      subnetworkId: subnetworkId++,
      nodeIndices: [] as number[],
      linkIndices: [] as number[],
      supplySourceCount: 0,
      pipeCount: 0,
      bounds: [Infinity, Infinity, -Infinity, -Infinity] as [
        number,
        number,
        number,
        number,
      ],
    };

    const visitedLinks = new Set<number>();
    const stack: number[] = [nodeId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;

      visited.add(current);
      component.nodeIndices.push(current);

      const nodeType = toNodeType(nodeTypesView.getById(current) ?? 0);
      if (nodeType === "reservoir" || nodeType === "tank") {
        component.supplySourceCount++;
      }

      const linkIds = nodesConnectionsView.getById(current) || [];
      for (const linkId of linkIds) {
        if (visitedLinks.has(linkId)) continue;

        visitedLinks.add(linkId);
        const linkType = linkTypesView.getById(linkId) ?? 0;
        if (linkType === 0) {
          component.pipeCount++;
        }

        component.linkIndices.push(linkId);

        const bounds = linkBoundsView.getById(linkId);
        if (bounds) {
          const [minX, minY, maxX, maxY] = bounds;
          component.bounds[0] = Math.min(component.bounds[0], minX);
          component.bounds[1] = Math.min(component.bounds[1], minY);
          component.bounds[2] = Math.max(component.bounds[2], maxX);
          component.bounds[3] = Math.max(component.bounds[3], maxY);
        }

        const linkConnection = linksView.getById(linkId);
        if (linkConnection) {
          const neighborId =
            linkConnection.startNode === current
              ? linkConnection.endNode
              : linkConnection.startNode;

          if (!visited.has(neighborId)) {
            stack.push(neighborId);
          }
        }
      }
    }

    if (component.nodeIndices.length > 1) {
      components.push(component);
    }
  }

  components.sort((a, b) => b.nodeIndices.length - a.nodeIndices.length);

  return { subnetworks: components };
}
