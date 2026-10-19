import { useAtomValue } from "jotai";
import { useCallback, useMemo } from "react";
import {
  AssetId,
  AssetIndexQueries,
  TopologyQueries,
} from "@epanet-js/hydraulic-model";
import { useIsEditionBlocked } from "src/hooks/use-is-edition-blocked";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { deactivateAssets } from "src/hydraulic-model/model-operations/deactivate-assets";
import { deleteAssets } from "src/hydraulic-model/model-operations/delete-assets";
import { ActiveAssetIndex, ActiveTopology } from "@epanet-js/hydraulic-model";
import { useUserTracking } from "src/infra/user-tracking";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";

export type OrphanKind = "isolatedNode" | "danglingLink" | "isolatedLink";

export const useFixOrphanAsset = () => {
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const userTracking = useUserTracking();
  const isEditionBlocked = useIsEditionBlocked();
  const { transact } = useModelTransaction();

  const { topology, assetIndex } = useMemo(
    () => ({
      topology: new ActiveTopology(
        hydraulicModel.topology,
        hydraulicModel.assets,
      ),
      assetIndex: new ActiveAssetIndex(
        hydraulicModel.assetIndex,
        hydraulicModel.assets,
      ),
    }),
    [hydraulicModel],
  );

  const kindOf = useCallback(
    (assetId: AssetId): OrphanKind | null =>
      classifyOrphan(assetId, topology, assetIndex),
    [topology, assetIndex],
  );

  const fix = useCallback(
    (assetId: AssetId) => {
      if (isEditionBlocked) return;

      const kind = kindOf(assetId);
      const asset = hydraulicModel.assets.get(assetId);
      if (!kind || !asset) return;

      if (kind !== "isolatedLink") {
        const data = { assetIds: [assetId], shouldUpdateCustomerPoints: true };
        transact(() => deleteAssets(hydraulicModel, data));
      } else {
        transact(() =>
          deactivateAssets(hydraulicModel, { assetIds: [assetId] }),
        );
      }

      userTracking.capture({
        name: "networkReview.orphanAssets.fixed",
        kind,
        assetId,
        type: asset.type,
      });
    },
    [kindOf, hydraulicModel, transact, userTracking, isEditionBlocked],
  );

  return { kindOf, fix };
};

const classifyOrphan = (
  assetId: AssetId,
  topology: TopologyQueries,
  assetIndex: AssetIndexQueries,
): OrphanKind | null => {
  if (assetIndex.hasNode(assetId)) {
    if (topology.getLinks(assetId).length > 0) return null;

    const nodeType = assetIndex.getNodeType(assetId);
    if (nodeType === "tank" || nodeType === "reservoir") return null;

    return "isolatedNode";
  }

  if (!assetIndex.hasLink(assetId)) return null;

  const [startNode, endNode] = topology.getNodes(assetId);
  if (!assetIndex.hasNode(startNode) || !assetIndex.hasNode(endNode)) {
    return "danglingLink";
  }

  if (assetIndex.getAssetType(assetId) === "pipe") return null;

  const startNodeConnections = topology.getLinks(startNode).length;
  const endNodeConnections = topology.getLinks(endNode).length;

  return startNodeConnections <= 1 && endNodeConnections <= 1
    ? "isolatedLink"
    : null;
};
