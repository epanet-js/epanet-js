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
  ChartLineIcon,
} from "src/icons";
import { selectedFeaturesDerivedAtom } from "src/state/derived-branch-state";
import { ActionButton, Action } from "src/components/action-button";
import { useIsEditionBlocked } from "src/hooks/use-is-edition-blocked";
import { useCustomGraph } from "src/hooks/use-custom-graph";
import { useUserTracking } from "src/infra/user-tracking";

export function useMultiAssetActions(readonly = false): Action[] {
  const translate = useTranslate();
  const zoomTo = useZoomTo();
  const deleteSelection = useDeleteSelection();
  const { changeSelectedAssetsActiveTopologyStatus, allActive } =
    useChangeSelectedAssetsActiveTopologyStatus();
  const selectedWrappedFeatures = useAtomValue(selectedFeaturesDerivedAtom);
  const { openCustomGraph } = useCustomGraph();
  const userTracking = useUserTracking();

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
    onSelect: openCustomGraph,
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
      userTracking.capture({
        name: "selection.zoomedTo",
        source: "asset-panel",
        count: selectedWrappedFeatures.length,
      });
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

  return [
    zoomToAction,
    changeActiveTopologyActionItem,
    customGraphAction,
    deleteAssetsAction,
  ];
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
