import { useCallback } from "react";
import { useAtomValue } from "jotai";
import { useTranslate } from "src/hooks/use-translate";
import { useZoomToSelection } from "src/commands/zoom-to-selection";
import { useSelectZoneContents } from "src/commands/select-zone-contents";
import { useDeleteSelection } from "src/commands/delete-selection";
import {
  useChangeSelectedAssetsActiveTopologyStatus,
  changeActiveTopologyShortcut,
} from "src/commands/change-selected-assets-active-topology-status";
import {
  BookmarkIcon,
  DeleteIcon,
  ZoomToIcon,
  ActivateTopologyIcon,
  DeactivateTopologyIcon,
  ChartLineIcon,
  DisconnectIcon,
  PolygonalSelectionIcon,
} from "src/icons";
import { selectionAtom } from "src/state/selection";
import { Action } from "src/components/action-button";
import { ActionsBar } from "src/components/actions-bar";
import { useIsEditionBlocked } from "src/hooks/use-is-edition-blocked";
import { useCustomGraph } from "src/hooks/use-custom-graph";
import { USelection } from "src/selection";
import { useDisconnectCustomerPoints } from "src/commands/customer-point-actions";
import { useStartCollectionDraft } from "src/commands/collection-draft";

export function useMultiAssetActions(readonly = false): Action[] {
  const translate = useTranslate();
  const zoomToSelection = useZoomToSelection();
  const selectZoneContents = useSelectZoneContents();
  const deleteSelection = useDeleteSelection();
  const { changeSelectedAssetsActiveTopologyStatus, allActive } =
    useChangeSelectedAssetsActiveTopologyStatus();
  const disconnectCustomerPoints = useDisconnectCustomerPoints();
  const selection = useAtomValue(selectionAtom);
  const {
    assets: assetCount,
    customerPoints: customerPointCount,
    zones: zoneCount,
  } = USelection.countByKind(selection);
  const { openCustomGraph } = useCustomGraph();
  const startCollectionDraft = useStartCollectionDraft();

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
    priority: 2,
    label: translate("customGraph.menuTitle"),
    onSelect: openCustomGraph,
  };

  const deleteAssetsAction = {
    label: translate("delete"),
    variant: "danger-quiet" as const,
    applicable: hasAssets || hasCustomerPoints || zoneCount > 0,
    priority: 1,
    disabled: readonly,
    icon: <DeleteIcon />,
    onSelect: onDelete,
  };

  const zoomToAction = {
    icon: <ZoomToIcon />,
    applicable: true,
    priority: 4,
    label: translate("zoomTo"),
    onSelect: function doZoomTo() {
      zoomToSelection({ source: "toolbar" });
      return Promise.resolve();
    },
  };

  const selectZoneContentsAction = {
    icon: <PolygonalSelectionIcon />,
    applicable: zoneCount > 0 && assetCount === 0 && customerPointCount === 0,
    priority: 5,
    label: translate("selectZoneContents"),
    onSelect: function doSelectZoneContents() {
      return selectZoneContents({ source: "toolbar" });
    },
  };

  const saveSelectionSetAction = {
    icon: <BookmarkIcon />,
    applicable: hasAssets || hasCustomerPoints || zoneCount > 0,
    label: translate("collections.selectionSets.save"),
    onSelect: function saveSelectionSet() {
      startCollectionDraft({
        kind: "selectionSets",
        source: "toolbar",
        label: "",
      });
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
    priority: 3,
    disabled: readonly,
    label: allActive
      ? translate("deactivateAssets")
      : translate("activateAssets"),
    shortcut: changeActiveTopologyShortcut,
    onSelect: onChangeActiveTopology,
  };

  return [
    zoomToAction,
    selectZoneContentsAction,
    saveSelectionSetAction,
    changeActiveTopologyActionItem,
    customGraphAction,
    disconnectCustomersAction,
    deleteAssetsAction,
  ];
}

export function MultiAssetActions() {
  const isEditionBlocked = useIsEditionBlocked();
  const actions = useMultiAssetActions(isEditionBlocked);

  return <ActionsBar actions={actions} />;
}
