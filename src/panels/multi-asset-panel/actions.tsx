import { useCallback } from "react";
import { useAtomValue } from "jotai";
import { useTranslate } from "src/hooks/use-translate";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { useDeleteSelection } from "src/commands/delete-selection";
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
import { selectedFeaturesDerivedAtom } from "src/state/derived-branch-state";
import { ActionButton, Action } from "src/components/action-button";
import { useIsBranchLocked } from "src/hooks/use-is-branch-locked";

export function useMultiAssetActions(readonly = false): Action[] {
  const translate = useTranslate();
  const zoomTo = useZoomTo();
  const deleteSelection = useDeleteSelection();
  const { changeSelectedAssetsActiveTopologyStatus, allActive } =
    useChangeSelectedAssetsActiveTopologyStatus();
  const selectedWrappedFeatures = useAtomValue(selectedFeaturesDerivedAtom);

  const onDelete = useCallback(() => {
    deleteSelection({ source: "toolbar" });
    return Promise.resolve();
  }, [deleteSelection]);

  const onChangeActiveTopology = useCallback(() => {
    changeSelectedAssetsActiveTopologyStatus({ source: "toolbar" });
    return Promise.resolve();
  }, [changeSelectedAssetsActiveTopologyStatus]);

  const deleteAssetsAction = {
    label: translate("delete"),
    variant: "danger-quiet" as const,
    applicable: true,
    disabled: readonly,
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
    disabled: readonly,
    label: allActive
      ? translate("deactivateAssets")
      : translate("activateAssets"),
    shortcut: changeActiveTopologyShortcut,
    onSelect: onChangeActiveTopology,
  };

  return [zoomToAction, changeActiveTopologyActionItem, deleteAssetsAction];
}

export function MultiAssetActions() {
  const isBranchLocked = useIsBranchLocked();
  const actions = useMultiAssetActions(isBranchLocked);

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
