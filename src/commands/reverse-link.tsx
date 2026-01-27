import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { LinkAsset } from "src/hydraulic-model";
import { reverseLink } from "src/hydraulic-model/model-operations/reverse-link";
import { useUserTracking } from "src/infra/user-tracking";
import { usePersistence } from "src/lib/persistence";
import { USelection } from "src/selection";
import { selectionAtom, stagingModelAtom } from "src/state/jotai";

export const reverseLinkShortcut = "r";

export const useReverseLink = () => {
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const selection = useAtomValue(selectionAtom);
  const userTracking = useUserTracking();
  const rep = usePersistence();
  const transact = rep.useTransact();

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
