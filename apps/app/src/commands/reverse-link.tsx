import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { LinkAsset } from "src/hydraulic-model";
import {
  reverseLink,
  reverseLinkDeprecated,
} from "src/hydraulic-model/model-operations/reverse-link";
import { useUserTracking } from "src/infra/user-tracking";
import { USelection } from "src/selection";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const reverseLinkShortcut = "r";

export const useReverseLink = () => {
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const selection = useAtomValue(selectionAtom);
  const userTracking = useUserTracking();
  const { transact } = useMomentTransaction();
  const { transact: transactChangeSet } = useModelTransaction();
  const isOpsChangeSetsOn = useFeatureFlag("FLAG_OPS_CHANGE_SETS");

  const reverseLinkAction = useCallback(
    ({ source }: { source: "shortcut" | "toolbar" | "context-menu" }) => {
      const selectedAssetId = USelection.singleAssetId(selection);
      if (selectedAssetId === null) return;

      const selectedAsset = hydraulicModel.assets.get(selectedAssetId);

      if (!selectedAsset || !selectedAsset.isLink) return;

      const linkAsset = selectedAsset as LinkAsset;

      userTracking.capture({
        name: "link.reversed",
        source,
        type: linkAsset.type,
      });

      if (isOpsChangeSetsOn) {
        transactChangeSet(() =>
          reverseLink(hydraulicModel, { linkId: linkAsset.id }),
        );
      } else {
        transact(
          reverseLinkDeprecated(hydraulicModel, { linkId: linkAsset.id }),
        );
      }
    },
    [
      selection,
      hydraulicModel,
      userTracking,
      isOpsChangeSetsOn,
      transact,
      transactChangeSet,
    ],
  );

  return reverseLinkAction;
};
