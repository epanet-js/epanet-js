import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { LinkAsset } from "src/hydraulic-model";
import { reverseLink } from "src/hydraulic-model/model-operations/reverse-link";
import { useUserTracking } from "src/infra/user-tracking";
import { USelection } from "src/selection";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";

export const reverseLinkShortcut = "r";

export const useReverseLink = () => {
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const selection = useAtomValue(selectionAtom);
  const userTracking = useUserTracking();
  const { transact } = useMomentTransaction();

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

      const moment = reverseLink(hydraulicModel, {
        linkId: linkAsset.id,
      });

      transact(moment);
    },
    [selection, hydraulicModel, userTracking, transact],
  );

  return reverseLinkAction;
};
