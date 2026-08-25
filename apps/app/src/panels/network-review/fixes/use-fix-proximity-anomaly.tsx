import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { AssetId, NodeAsset, nodesShareLink } from "@epanet-js/hydraulic-model";
import { Position } from "src/types";
import distance from "@turf/distance";
import { point } from "@turf/helpers";
import { HydraulicModel } from "src/hydraulic-model";
import { useIsEditionBlocked } from "src/hooks/use-is-edition-blocked";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { mergeNodes, moveNode } from "src/hydraulic-model/model-operations";
import { useUserTracking } from "src/infra/user-tracking";
import {
  CONNECTED_JUNCTION_TOLERANCE_IN_METERS,
  ProximityAnomaly,
} from "src/lib/network-review";
import { modelFactoriesAtom } from "src/state/model-factories";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { projectSettingsAtom } from "src/state/project-settings";

export const useFixProximityAnomaly = () => {
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { units } = useAtomValue(projectSettingsAtom);
  const { assetFactory, labelManager } = useAtomValue(modelFactoriesAtom);
  const userTracking = useUserTracking();
  const isEditionBlocked = useIsEditionBlocked();
  const { transact } = useMomentTransaction();

  const fix = useCallback(
    (anomaly: ProximityAnomaly) => {
      if (isEditionBlocked) return;

      const node = hydraulicModel.assets.get(anomaly.nodeId) as
        | NodeAsset
        | undefined;
      const pipe = hydraulicModel.assets.get(anomaly.pipeId);
      if (!node || node.isLink || !pipe || pipe.type !== "pipe") return;

      const endpointNodeId = endpointNodeAt(
        hydraulicModel,
        anomaly.pipeId,
        anomaly.nearestPointOnPipe,
      );

      if (endpointNodeId !== null) {
        if (
          nodesShareLink(
            hydraulicModel.topology,
            anomaly.nodeId,
            endpointNodeId,
          )
        ) {
          return;
        }

        transact(
          mergeNodes(hydraulicModel, {
            sourceNodeId: anomaly.nodeId,
            targetNodeId: endpointNodeId,
            lengthUnit: units.length,
          }),
        );
      } else {
        transact(
          moveNode(hydraulicModel, {
            nodeId: anomaly.nodeId,
            newCoordinates: anomaly.nearestPointOnPipe,
            newElevation: node.elevation,
            shouldUpdateCustomerPoints: true,
            pipeIdToSplit: anomaly.pipeId,
            lengthUnit: units.length,
            assetFactory,
            labelManager,
          }),
        );
      }

      userTracking.capture({
        name: "networkReview.proximityAnomalies.fixed",
        nodeId: anomaly.nodeId,
        pipeId: anomaly.pipeId,
        distance: anomaly.distance,
      });
    },
    [
      hydraulicModel,
      units.length,
      assetFactory,
      labelManager,
      transact,
      userTracking,
      isEditionBlocked,
    ],
  );

  return { fix };
};

export const endpointNodeAt = (
  hydraulicModel: HydraulicModel,
  pipeId: AssetId,
  connectionPoint: Position,
): AssetId | null => {
  const [startNodeId, endNodeId] = hydraulicModel.topology.getNodes(pipeId);

  for (const nodeId of [startNodeId, endNodeId]) {
    const node = hydraulicModel.assets.get(nodeId) as NodeAsset | undefined;
    if (!node) continue;

    const gap = distance(point(connectionPoint), point(node.coordinates), {
      units: "meters",
    });
    if (gap < CONNECTED_JUNCTION_TOLERANCE_IN_METERS) return nodeId;
  }

  return null;
};
