import { TrashIcon, Crosshair1Icon } from "@radix-ui/react-icons";
import type {
  Action,
  ActionProps,
} from "src/components/context_actions/action_item";
import { B3Variant } from "src/components/elements";
import { ActionItem } from "./action_item";
import { useCallback } from "react";
import { useZoomTo } from "src/hooks/use_zoom_to";
import { IWrappedFeature } from "src/types";
import { translate } from "src/infra/i18n";
import { useDeleteSelectedAssets } from "src/commands/delete-selected-assets";

export function useActions(
  selectedWrappedFeatures: IWrappedFeature[],
  source: ActionProps["as"],
): Action[] {
  const zoomTo = useZoomTo();
  const deleteSelectedAssets = useDeleteSelectedAssets();

  const onDelete = useCallback(() => {
    const eventSource = source === "context-item" ? "context-menu" : "toolbar";
    deleteSelectedAssets({ source: eventSource });
    return Promise.resolve();
  }, [deleteSelectedAssets, source]);

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
