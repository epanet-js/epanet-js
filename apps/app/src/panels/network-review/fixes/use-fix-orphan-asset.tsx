import { useAtomValue } from "jotai";
import { useCallback, useMemo } from "react";
import { AssetId } from "@epanet-js/hydraulic-model";
import { useIsEditionBlocked } from "src/hooks/use-is-edition-blocked";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { deactivateAssets } from "src/hydraulic-model/model-operations/deactivate-assets";
import { deleteAssets } from "src/hydraulic-model/model-operations/delete-assets";
import {
  ActiveAssetIndex,
  ActiveTopology,
} from "src/hydraulic-model/utilities/active-only-queries";
import { useUserTracking } from "src/infra/user-tracking";
import { classifyOrphan, OrphanKind } from "src/lib/network-review";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";

export const useFixOrphanAsset = () => {
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const userTracking = useUserTracking();
  const isEditionBlocked = useIsEditionBlocked();
  const { transact } = useMomentTransaction();

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

      const moment =
        kind === "isolatedLink"
          ? deactivateAssets(hydraulicModel, { assetIds: [assetId] })
          : deleteAssets(hydraulicModel, {
              assetIds: [assetId],
              shouldUpdateCustomerPoints: true,
            });

      transact(moment);

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
