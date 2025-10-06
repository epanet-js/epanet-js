import { useCallback } from "react";
import { useAtomValue } from "jotai";
import { useTranslate } from "src/hooks/use-translate";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { useDeleteSelectedAssets } from "src/commands/delete-selected-assets";
import { DeleteIcon, ZoomToIcon } from "src/icons";
import { selectedFeaturesAtom } from "src/state/jotai";
import { ActionButton, Action } from "../asset-panel/actions/action-button";

export function useMultiAssetActions(): Action[] {
  const translate = useTranslate();
  const zoomTo = useZoomTo();
  const deleteSelectedAssets = useDeleteSelectedAssets();
  const selectedWrappedFeatures = useAtomValue(selectedFeaturesAtom);

  const onDelete = useCallback(() => {
    deleteSelectedAssets({ source: "toolbar" });
    return Promise.resolve();
  }, [deleteSelectedAssets]);

  const deleteAssetsAction = {
    label: translate("delete"),
    variant: "danger-quiet" as const,
    applicable: true,
    icon: <DeleteIcon />,
    onSelect: onDelete,
  };

  const zoomToAction = {
    icon: <ZoomToIcon />,
    applicable: true,
    label: translate("zoomTo"),
    onSelect: function doZoomTo() {
      return Promise.resolve(zoomTo(selectedWrappedFeatures));
    },
  };

  return [zoomToAction, deleteAssetsAction];
}

export function MultiAssetActions() {
  const actions = useMultiAssetActions();

  return (
    <div className="flex gap-1">
      {actions
        .filter((action) => action.applicable)
        .map((action, i) => (
          <ActionButton key={i} action={action} />
        ))}
    </div>
  );
}
