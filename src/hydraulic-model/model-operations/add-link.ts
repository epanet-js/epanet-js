import { NodeAsset, LinkAsset, AssetId, Asset } from "../asset-types";
import { buildDefaultPumpCurve, ICurve } from "../curves";
import { Pipe } from "../asset-types/pipe";
import distance from "@turf/distance";
import { ModelOperation } from "../model-operation";
import { Position } from "geojson";
import { LabelGenerator } from "../label-manager";
import { splitPipe } from "./split-pipe";
import { AssetsMap } from "../assets-map";
import { HydraulicModel } from "../hydraulic-model";
import { CustomerPoint } from "../customer-points";
import { inferNodeIsActive } from "../utilities/active-topology";
import { copyPipePropertiesToLink } from "./mutations/copy-link-properties";

type InputData = {
  link: LinkAsset;
  startNode: NodeAsset;
  endNode: NodeAsset;
  startPipeId?: AssetId;
  endPipeId?: AssetId;
};

export const addLink: ModelOperation<InputData> = (hydraulicModel, data) => {
  const { link, startNode, endNode, startPipeId, endPipeId } = data;
  const linkCopy = link.copy();
  const startNodeCopy = startNode.copy();
  const endNodeCopy = endNode.copy();

  addMissingLabels(
    hydraulicModel.labelManager,
    linkCopy,
    startNodeCopy,
    endNodeCopy,
  );
  linkCopy.setConnections(startNodeCopy.id, endNodeCopy.id);
  forceSpatialConnectivity(linkCopy, startNodeCopy, endNodeCopy);
  removeRedundantVertices(linkCopy);

  linkCopy.setProperty(
    "isActive",
    inferLinkActiveTopologyStatus(hydraulicModel, data),
  );

  startNodeCopy.setProperty(
    "isActive",
    inferNodeActiveTopologyStatus(
      hydraulicModel,
      startNodeCopy,
      linkCopy,
      startPipeId,
    ),
  );

  endNodeCopy.setProperty(
    "isActive",
    inferNodeActiveTopologyStatus(
      hydraulicModel,
      endNodeCopy,
      linkCopy,
      endPipeId,
    ),
  );

  let putCurves: ICurve[] | undefined;
  if (linkCopy.type === "pump") {
    const curve = buildDefaultPumpCurve(
      hydraulicModel.curves,
      hydraulicModel.labelManager,
      linkCopy.label,
    );
    linkCopy.setProperty("curveId", curve.id);
    putCurves = [curve];
  }

  const { putAssets, deleteAssets, putCustomerPoints } = handlePipeSplits({
    link: linkCopy,
    startNode: startNodeCopy,
    endNode: endNodeCopy,
    startPipeId,
    endPipeId,
    hydraulicModel,
  });

  return {
    note: `Add ${link.type}`,
    deleteAssets: deleteAssets.length > 0 ? deleteAssets : undefined,
    putCurves,
    ...removeOverlappingPipes({
      link: linkCopy,
      startNode: startNodeCopy,
      endNode: endNodeCopy,
      putAssets,
      putCustomerPoints,
    }),
  };
};

const inferLinkActiveTopologyStatus = (
  hydraulicModel: HydraulicModel,
  { link, startNode, endNode, startPipeId, endPipeId }: InputData,
): boolean => {
  if (link.isActive === false) return false;

  const { topology, assets } = hydraulicModel;

  const isSplittingActivePipe = (pipeId?: AssetId): boolean => {
    if (pipeId === undefined) return false;

    const pipe = assets.get(pipeId);
    return !!pipe && pipe.isActive;
  };

  const isNodeOrphan = (node: NodeAsset, splitPipeId?: AssetId): boolean =>
    topology.getLinks(node.id).length === 0 && !splitPipeId;

  const hasNodeCurrentActiveConnections = (node: NodeAsset): boolean => {
    if (node.isActive === false) return false;

    const hasActiveConnections = topology.getLinks(node.id).some((linkId) => {
      const link = assets.get(linkId);
      return !!link && link.isActive;
    });
    return hasActiveConnections;
  };

  const canStartNodeBeInactive =
    !hasNodeCurrentActiveConnections(startNode) &&
    !isSplittingActivePipe(startPipeId);

  const canEndNodeBeInactive =
    !hasNodeCurrentActiveConnections(endNode) &&
    !isSplittingActivePipe(endPipeId);

  if (
    isNodeOrphan(startNode, startPipeId) &&
    isNodeOrphan(endNode, endPipeId)
  ) {
    return true;
  }

  return !canStartNodeBeInactive || !canEndNodeBeInactive;
};

const inferNodeActiveTopologyStatus = (
  hydraulicModel: HydraulicModel,
  node: NodeAsset,
  newLink: LinkAsset,
  splitPipeId?: AssetId,
): boolean => {
  if (!splitPipeId)
    return inferNodeIsActive(
      node,
      new Set(),
      [newLink],
      hydraulicModel.topology,
      hydraulicModel.assets,
    );

  const splitPipe = hydraulicModel.assets.get(splitPipeId);
  return !!splitPipe && splitPipe.isActive;
};

const addMissingLabels = (
  labelGenerator: LabelGenerator,
  link: LinkAsset,
  startNode: NodeAsset,
  endNode: NodeAsset,
) => {
  if (link.label === "") {
    link.setProperty("label", labelGenerator.generateFor(link.type, link.id));
  }
  if (startNode.label === "") {
    startNode.setProperty(
      "label",
      labelGenerator.generateFor(startNode.type, startNode.id),
    );
  }
  if (endNode.label === "") {
    endNode.setProperty(
      "label",
      labelGenerator.generateFor(endNode.type, endNode.id),
    );
  }
};

const handlePipeSplits = ({
  link,
  startNode,
  endNode,
  startPipeId,
  endPipeId,
  hydraulicModel,
}: {
  link: LinkAsset;
  startNode: NodeAsset;
  endNode: NodeAsset;
  startPipeId?: AssetId;
  endPipeId?: AssetId;
  hydraulicModel: HydraulicModel;
}): {
  putAssets: Asset[];
  deleteAssets: AssetId[];
  putCustomerPoints: CustomerPoint[];
} => {
  const allPutAssets = [link, startNode, endNode];
  const allPutCustomerPoints: CustomerPoint[] = [];
  const allDeleteAssets: AssetId[] = [];

  const plannedSplits: {
    pipeId: AssetId;
    splitNodes: NodeAsset[];
    context: string;
  }[] = [];
  if (startPipeId && endPipeId && startPipeId === endPipeId) {
    plannedSplits.push({
      pipeId: startPipeId,
      splitNodes: [startNode, endNode],
      context: "Pipe",
    });
  } else {
    if (startPipeId) {
      plannedSplits.push({
        pipeId: startPipeId,
        splitNodes: [startNode],
        context: "Start pipe",
      });
    }
    if (endPipeId) {
      plannedSplits.push({
        pipeId: endPipeId,
        splitNodes: [endNode],
        context: "End pipe",
      });
    }
  }

  plannedSplits.forEach((splitConfig) => {
    const pipe = validatePipeOrThrow(
      hydraulicModel.assets,
      splitConfig.pipeId,
      splitConfig.context,
    );
    const splitResult = splitPipe(hydraulicModel, {
      pipe,
      splits: splitConfig.splitNodes,
    });
    allPutAssets.push(...splitResult.putAssets!);
    allPutCustomerPoints.push(...(splitResult.putCustomerPoints || []));
    allDeleteAssets.push(...splitResult.deleteAssets!);
  });

  return {
    deleteAssets: allDeleteAssets,
    putAssets: allPutAssets,
    putCustomerPoints: allPutCustomerPoints,
  };
};

const removeOverlappingPipes = ({
  link,
  startNode,
  endNode,
  putAssets,
  putCustomerPoints,
}: {
  link: LinkAsset;
  startNode: NodeAsset;
  endNode: NodeAsset;
  putAssets: Asset[];
  putCustomerPoints: CustomerPoint[];
}) => {
  const overlappingPipeIndex = findOverlappingPipeIndex({
    link,
    startNode,
    endNode,
    putAssets,
  });

  if (overlappingPipeIndex === -1) {
    return { putAssets, putCustomerPoints };
  }

  const overlappingPipe = putAssets[overlappingPipeIndex] as Pipe;

  putAssets.splice(overlappingPipeIndex, 1);
  copyPipePropertiesToLink(overlappingPipe, link);

  return {
    putAssets,
    putCustomerPoints: updateCustomerPoints({
      customerPoints: putCustomerPoints,
      oldPipeId: overlappingPipe.id,
      newLink: link,
    }),
  };
};

const findOverlappingPipeIndex = ({
  link,
  startNode,
  endNode,
  putAssets,
}: {
  link: LinkAsset;
  startNode: NodeAsset;
  endNode: NodeAsset;
  putAssets: Asset[];
}): number => {
  if (link.coordinates.length > 2) return -1;

  const candidateOverlappingPipeIndex = putAssets.findIndex((asset) => {
    if (asset.type !== "pipe" || asset.id === link.id) return;
    const connections = new Set((asset as LinkAsset).connections);
    if (connections.has(startNode.id) && connections.has(endNode.id))
      return true;
    return false;
  });

  if (candidateOverlappingPipeIndex === -1) return -1;

  const candidateOverlappingPipe = putAssets[
    candidateOverlappingPipeIndex
  ] as LinkAsset;

  if (candidateOverlappingPipe.coordinates.length > 2) {
    return -1;
  }

  return candidateOverlappingPipeIndex;
};

const updateCustomerPoints = ({
  customerPoints,
  oldPipeId,
  newLink,
}: {
  customerPoints: CustomerPoint[];
  oldPipeId: number;
  newLink: LinkAsset;
}): CustomerPoint[] => {
  const customerPointsThatNeedReallocation = customerPoints.filter(
    (customerPoint) => customerPoint.connection?.pipeId === oldPipeId,
  );

  if (!customerPointsThatNeedReallocation.length) return customerPoints;

  if (newLink.type === "pipe") {
    customerPointsThatNeedReallocation.forEach((customerPoint) => {
      if (!customerPoint.connection) return;
      customerPoint.connection.pipeId = newLink.id;
    });

    return customerPoints;
  }

  return customerPoints.map((customerPoint) => {
    if (customerPoint.connection?.pipeId === oldPipeId) {
      return customerPoint.copyDisconnected();
    }
    return customerPoint;
  });
};

const removeRedundantVertices = (link: LinkAsset) => {
  const vertices = link.coordinates;
  if (vertices.length <= 2) {
    return;
  }
  const start = vertices[0];
  const end = vertices[vertices.length - 1];

  const result = [start];

  for (let i = 1; i < vertices.length - 1; i++) {
    const prev = result[result.length - 1];
    const current = vertices[i];
    if (!isAlmostTheSamePoint(prev, current)) {
      result.push(current);
    }
  }

  const lastInResult = result[result.length - 1];
  if (isAlmostTheSamePoint(lastInResult, end) && result.length >= 2) {
    result[result.length - 1] = end;
  } else {
    result.push(end);
  }

  link.setCoordinates(result);
};

const forceSpatialConnectivity = (
  link: LinkAsset,
  startNode: NodeAsset,
  endNode: NodeAsset,
) => {
  const newCoordinates = [...link.coordinates];
  newCoordinates[0] = startNode.coordinates;
  newCoordinates[newCoordinates.length - 1] = endNode.coordinates;

  link.setCoordinates(newCoordinates);
};

const isAlmostTheSamePoint = (a: Position, b: Position) => {
  const minResolutionInMeters = 1;
  const distanceInMeters = distance(a, b) * 1000;
  return distanceInMeters <= minResolutionInMeters;
};

const validatePipeOrThrow = (
  assets: AssetsMap,
  pipeId: AssetId,
  context: string = "Pipe",
): Pipe => {
  const asset = assets.get(pipeId);
  if (!asset) {
    throw new Error(`${context} not found: ${pipeId} (asset does not exist)`);
  }
  if (asset.type !== "pipe") {
    throw new Error(
      `Invalid ${context.toLowerCase()} ID: ${pipeId} (found ${asset.type} instead of pipe)`,
    );
  }
  return asset as Pipe;
};
