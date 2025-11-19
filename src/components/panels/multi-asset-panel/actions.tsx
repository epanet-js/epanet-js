import { useCallback } from "react";
import { useAtomValue } from "jotai";
import { useTranslate } from "src/hooks/use-translate";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { useDeleteSelectedAssets } from "src/commands/delete-selected-assets";
import {
  useChangeSelectedAssetsActiveTopologyStatus,
  changeActiveTopologyShortcut,
} from "src/commands/change-selected-assets-active-topology-status";
import {
  DeleteIcon,
  ZoomToIcon,
  ActivateTopologyIcon,
  DeactivateTopologyIcon,
} from "src/icons";
import { selectedFeaturesAtom } from "src/state/jotai";
import { ActionButton, Action } from "../asset-panel/actions/action-button";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export function useMultiAssetActions(): Action[] {
  const translate = useTranslate();
  const zoomTo = useZoomTo();
  const deleteSelectedAssets = useDeleteSelectedAssets();
  const { changeSelectedAssetsActiveTopologyStatus, allActive } =
    useChangeSelectedAssetsActiveTopologyStatus();
  const selectedWrappedFeatures = useAtomValue(selectedFeaturesAtom);
  const isBulkActiveTopologyEnabled = useFeatureFlag(
    "FLAG_BULK_ACTIVE_TOPOLOGY",
  );

  const onDelete = useCallback(() => {
    deleteSelectedAssets({ source: "toolbar" });
    return Promise.resolve();
  }, [deleteSelectedAssets]);

  const onChangeActiveTopology = useCallback(() => {
    changeSelectedAssetsActiveTopologyStatus({ source: "toolbar" });
    return Promise.resolve();
  }, [changeSelectedAssetsActiveTopologyStatus]);

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

  const changeActiveTopologyActionItem = {
    icon: allActive ? <DeactivateTopologyIcon /> : <ActivateTopologyIcon />,
    applicable: true,
    label: allActive
      ? translate("deactivateAssets")
      : translate("activateAssets"),
    shortcut: changeActiveTopologyShortcut,
    onSelect: onChangeActiveTopology,
  };

  return isBulkActiveTopologyEnabled
    ? [zoomToAction, changeActiveTopologyActionItem, deleteAssetsAction]
    : [zoomToAction, deleteAssetsAction];
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
