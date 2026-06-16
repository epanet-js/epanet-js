import { useCallback } from "react";
import { useAtomValue } from "jotai";
import { useTranslate } from "src/hooks/use-translate";
import { useZoomToSelection } from "src/commands/zoom-to-selection";
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
  DisconnectIcon,
} from "src/icons";
import { selectionAtom } from "src/state/selection";
import { ActionButton, Action } from "src/components/action-button";
import { useIsEditionBlocked } from "src/hooks/use-is-edition-blocked";
import { useCustomGraph } from "src/hooks/use-custom-graph";
import { USelection } from "src/selection";
import { useDisconnectCustomerPoints } from "src/commands/customer-point-actions";

export function useMultiAssetActions(readonly = false): Action[] {
  const translate = useTranslate();
  const zoomToSelection = useZoomToSelection();
  const deleteSelection = useDeleteSelection();
  const { changeSelectedAssetsActiveTopologyStatus, allActive } =
    useChangeSelectedAssetsActiveTopologyStatus();
  const disconnectCustomerPoints = useDisconnectCustomerPoints();
  const selection = useAtomValue(selectionAtom);
  const { assets: assetCount, customerPoints: customerPointCount } =
    USelection.countByKind(selection);
  const { openCustomGraph } = useCustomGraph();

  const hasAssets = assetCount > 0;
  const hasCustomerPoints = customerPointCount > 0;
  const onlyHasCustomerPoints = hasCustomerPoints && !hasAssets;

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
    applicable: hasAssets,
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
      zoomToSelection({ source: "toolbar" });
      return Promise.resolve();
    },
  };

  const disconnectCustomersAction = {
    label: onlyHasCustomerPoints
      ? translate("contextActions.customerPoints.disconnect")
      : translate("contextActions.customerPoints.disconnectCustomers"),
    icon: <DisconnectIcon />,
    applicable: hasCustomerPoints,
    onSelect: function disconnectCustomers() {
      disconnectCustomerPoints({ source: "toolbar" });
      return Promise.resolve();
    },
  };

  const changeActiveTopologyActionItem = {
    icon: allActive ? <DeactivateTopologyIcon /> : <ActivateTopologyIcon />,
    applicable: hasAssets,
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
    disconnectCustomersAction,
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
