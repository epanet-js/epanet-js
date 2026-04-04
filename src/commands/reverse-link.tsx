import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { LinkAsset } from "src/hydraulic-model";
import { reverseLink } from "src/hydraulic-model/model-operations/reverse-link";
import { useUserTracking } from "src/infra/user-tracking";
import { usePersistence } from "src/lib/persistence";
import { USelection } from "src/selection";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { selectionAtom } from "src/state/selection";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useModelTransaction } from "src/hooks/use-model-transaction";

export const reverseLinkShortcut = "r";

export const useReverseLink = () => {
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const selection = useAtomValue(selectionAtom);
  const userTracking = useUserTracking();
  const isStateRefactorOn = useFeatureFlag("FLAG_STATE_REFACTOR");
  const rep = usePersistence();
  const transactDeprecated = rep.useTransactDeprecated();
  const { transact: transactNew } = useModelTransaction();
  const transact = isStateRefactorOn ? transactNew : transactDeprecated;

  const reverseLinkAction = useCallback(
    ({ source }: { source: "shortcut" | "toolbar" | "context-menu" }) => {
      const selectedIds = USelection.toIds(selection);

      if (selectedIds.length !== 1) return;

      const selectedAsset = hydraulicModel.assets.get(selectedIds[0]);

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
