import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";
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
  ChartLineIcon,
} from "src/icons";
import { selectedFeaturesDerivedAtom } from "src/state/derived-branch-state";
import { ActionButton, Action } from "src/components/action-button";
import { useIsEditionBlocked } from "src/hooks/use-is-edition-blocked";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useShowPriorityAccessDialog } from "src/hooks/use-priority-access";
import { usePermissions } from "src/hooks/use-permissions";

export function useMultiAssetActions(readonly = false): Action[] {
  const translate = useTranslate();
  const zoomTo = useZoomTo();
  const deleteSelection = useDeleteSelection();
  const { changeSelectedAssetsActiveTopologyStatus, allActive } =
    useChangeSelectedAssetsActiveTopologyStatus();
  const selectedWrappedFeatures = useAtomValue(selectedFeaturesDerivedAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const isCustomGraphsOn = useFeatureFlag("FLAG_CUSTOM_GRAPHS");
  const showPriorityAccess = useShowPriorityAccessDialog();
  const { canUseCustomGraphs } = usePermissions();

  const onDelete = useCallback(() => {
    deleteSelection({ source: "toolbar" });
    return Promise.resolve();
  }, [deleteSelection]);

  const onChangeActiveTopology = useCallback(() => {
    changeSelectedAssetsActiveTopologyStatus({ source: "toolbar" });
    return Promise.resolve();
  }, [changeSelectedAssetsActiveTopologyStatus]);

  const customGraphAction = {
    icon: <ChartLineIcon />,
    applicable: true,
    label: translate("customGraph.menuTitle"),
    onSelect: function openCustomGraph() {
      if (!canUseCustomGraphs) {
        showPriorityAccess({
          featureName: translate("customGraph.title"),
        });
        return Promise.resolve();
      }
      setDialogState({ type: "customGraph" });
      return Promise.resolve();
    },
  };

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

  return isCustomGraphsOn
    ? [
        zoomToAction,
        changeActiveTopologyActionItem,
        customGraphAction,
        deleteAssetsAction,
      ]
    : [zoomToAction, changeActiveTopologyActionItem, deleteAssetsAction];
}

export function MultiAssetActions() {
  const isEditionBlocked = useIsEditionBlocked();
  const actions = useMultiAssetActions(isEditionBlocked);

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
