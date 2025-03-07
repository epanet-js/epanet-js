import { TrashIcon, Crosshair1Icon } from "@radix-ui/react-icons";
import type {
  Action,
  ActionProps,
} from "src/components/context_actions/action_item";
import { B3Variant } from "src/components/elements";
import { usePersistence } from "src/lib/persistence/context";
import { selectionAtom, dataAtom } from "src/state/jotai";
import { ActionItem } from "./action_item";
import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { useZoomTo } from "src/hooks/use_zoom_to";
import { IWrappedFeature } from "src/types";
import { USelection } from "src/selection";
import { deleteAssets } from "src/hydraulic-model/model-operations";
import { translate } from "src/infra/i18n";
import { isFeatureOn } from "src/infra/feature-flags";
import { useUserTracking } from "src/infra/user-tracking";

export function useActions(
  selectedWrappedFeatures: IWrappedFeature[],
  source: ActionProps["as"],
): Action[] {
  const rep = usePersistence();
  const transact = rep.useTransact();
  const zoomTo = useZoomTo();
  const userTracking = useUserTracking();

  const onDelete = useAtomCallback(
    useCallback(
      (get, set) => {
        const { hydraulicModel, selection } = get(dataAtom);
        set(selectionAtom, USelection.none());

        const assetIds = USelection.toIds(selection);
        const moment = deleteAssets(hydraulicModel, {
          assetIds,
        });
        if (isFeatureOn("FLAG_TRACKING")) {
          const eventSource =
            source === "context-item" ? "context-menu" : "toolbar";
          userTracking.capture({
            name: "assets.deleted",
            source: eventSource,
            count: assetIds.length,
          });
        }

        transact(moment);
        return Promise.resolve();
      },
      [transact, userTracking, source],
    ),
  );

  const deleteAssetsAction = {
    label: translate("delete"),
    variant: "destructive" as B3Variant,
    applicable: true,
    icon: <TrashIcon />,
    onSelect: onDelete,
  };

  const zoomToAction = {
    icon: <Crosshair1Icon />,
    applicable: true,
    label: translate("zoomTo"),
    onSelect: function doAddInnerRing() {
      return Promise.resolve(zoomTo(selectedWrappedFeatures));
    },
  };

  return [zoomToAction, deleteAssetsAction];
}

export function GeometryActions({
  as,
  selectedWrappedFeatures,
}: {
  as: ActionProps["as"];
  selectedWrappedFeatures: IWrappedFeature[];
}) {
  const actions = useActions(selectedWrappedFeatures, as);

  return (
    <>
      {actions
        .filter((action) => action.applicable)
        .map((action, i) => (
          <ActionItem as={as} key={i} action={action} />
        ))}
    </>
  );
}
