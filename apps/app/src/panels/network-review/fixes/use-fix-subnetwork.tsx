import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { useIsEditionBlocked } from "src/hooks/use-is-edition-blocked";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { deactivateAssets } from "src/hydraulic-model/model-operations/deactivate-assets";
import { useUserTracking } from "src/infra/user-tracking";
import { SubNetwork } from "src/lib/network-review";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";

// A supplied subnetwork is the working network, not a finding. A subnetwork with
// no links has nothing `deactivateAssets` can act on — it is a lone node, and
// the orphan assets check owns that remedy.
export const canDisableSubnetwork = (subnetwork: SubNetwork): boolean =>
  subnetwork.supplySourceCount === 0 && subnetwork.linkIds.length > 0;

export const useFixSubnetwork = () => {
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const userTracking = useUserTracking();
  const isEditionBlocked = useIsEditionBlocked();
  const { transact } = useMomentTransaction();

  const fix = useCallback(
    (subnetwork: SubNetwork) => {
      if (isEditionBlocked || !canDisableSubnetwork(subnetwork)) return;

      transact(
        deactivateAssets(hydraulicModel, { assetIds: subnetwork.linkIds }),
      );

      userTracking.capture({
        name: "networkReview.connectivityTrace.fixed",
        linkCount: subnetwork.linkIds.length,
        nodeCount: subnetwork.nodeIds.length,
      });
    },
    [hydraulicModel, transact, userTracking, isEditionBlocked],
  );

  return { fix };
};
