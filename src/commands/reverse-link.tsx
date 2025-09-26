import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { LinkAsset } from "src/hydraulic-model";
import { reverseLink } from "src/hydraulic-model/model-operations/reverse-link";
import { useUserTracking } from "src/infra/user-tracking";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { usePersistence } from "src/lib/persistence/context";
import { USelection } from "src/selection";
import { dataAtom, selectionAtom } from "src/state/jotai";

export const reverseLinkShortcut = "r";

export const useReverseLink = () => {
  const { hydraulicModel } = useAtomValue(dataAtom);
  const selection = useAtomValue(selectionAtom);
  const isReverseOn = useFeatureFlag("FLAG_REVERSE");
  const userTracking = useUserTracking();
  const rep = usePersistence();
  const transact = rep.useTransact();

  const reverseLinkAction = useCallback(
    ({ source }: { source: "shortcut" | "toolbar" | "context-menu" }) => {
      if (!isReverseOn) return;

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
    [isReverseOn, selection, hydraulicModel, userTracking, transact],
  );

  return reverseLinkAction;
};
