import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { useIsEditionBlocked } from "src/hooks/use-is-edition-blocked";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import {
  deactivateAssets,
  deactivateAssetsDeprecated,
} from "src/hydraulic-model/model-operations/deactivate-assets";
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
  const { transact: transactChangeSet } = useModelTransaction();
  const isOpsChangeSetsOn = useFeatureFlag("FLAG_OPS_CHANGE_SETS");

  const fix = useCallback(
    (subnetwork: SubNetwork) => {
      if (isEditionBlocked || !canDisableSubnetwork(subnetwork)) return;

      const data = { assetIds: subnetwork.linkIds };
      if (isOpsChangeSetsOn) {
        transactChangeSet(deactivateAssets(hydraulicModel, data));
      } else {
        transact(deactivateAssetsDeprecated(hydraulicModel, data));
      }

      userTracking.capture({
        name: "networkReview.connectivityTrace.fixed",
        linkCount: subnetwork.linkIds.length,
        nodeCount: subnetwork.nodeIds.length,
      });
    },
    [
      hydraulicModel,
      isOpsChangeSetsOn,
      transact,
      transactChangeSet,
      userTracking,
      isEditionBlocked,
    ],
  );

  return { fix };
};
