import { useCallback } from "react";
import { useAtomValue } from "jotai";
import { useTranslate } from "src/hooks/use-translate";
import { useZoomToSelection } from "src/commands/zoom-to-selection";
import { useDeleteSelection } from "src/commands/delete-selection";
import { useSetRedrawMode } from "src/commands/set-redraw-mode";
import { useReverseLink } from "src/commands/reverse-link";
import {
  DeleteIcon,
  ZoomToIcon,
  RedrawIcon,
  ReverseIcon,
  DeactivateTopologyIcon,
  ActivateTopologyIcon,
  ChartLineIcon,
} from "src/icons";
import { Mode, modeAtom } from "src/state/mode";
import { Action } from "src/components/action-button";
import { ActionsBar } from "src/components/actions-bar";
import {
  changeActiveTopologyShortcut,
  useChangeSelectedAssetsActiveTopologyStatus,
} from "src/commands/change-selected-assets-active-topology-status";
import { useCustomGraph } from "src/hooks/use-custom-graph";

export function useLinkActions(readonly = false): Action[] {
  const translate = useTranslate();
  const zoomToSelection = useZoomToSelection();
  const deleteSelection = useDeleteSelection();
  const { mode: currentMode } = useAtomValue(modeAtom);
  const setRedrawMode = useSetRedrawMode();
  const reverseLinkAction = useReverseLink();
  const { changeSelectedAssetsActiveTopologyStatus, allActive } =
    useChangeSelectedAssetsActiveTopologyStatus();
  const { openCustomGraph } = useCustomGraph();

  const onDelete = useCallback(() => {
    deleteSelection({ source: "toolbar" });
    return Promise.resolve();
  }, [deleteSelection]);

  const deleteAssetsAction = {
    label: translate("delete"),
    variant: "danger-quiet" as const,
    applicable: true,
    priority: 1,
    disabled: readonly,
    icon: <DeleteIcon />,
    onSelect: onDelete,
  };

  const zoomToAction = {
    icon: <ZoomToIcon />,
    applicable: true,
    priority: 6,
    label: translate("zoomTo"),
    onSelect: function doZoomTo() {
      zoomToSelection({ source: "toolbar" });
      return Promise.resolve();
    },
  };

  const redrawAction = {
    icon: <RedrawIcon />,
    applicable: true,
    priority: 3,
    disabled: readonly,
    label: translate("redraw"),
    selected: currentMode === Mode.REDRAW_LINK,
    onSelect: function redrawLink() {
      setRedrawMode({ source: "toolbar" });
      return Promise.resolve();
    },
  };

  const reverseAction = {
    icon: <ReverseIcon />,
    applicable: true,
    priority: 5,
    disabled: readonly,
    label: translate("reverse"),
    onSelect: function reverseLinkActionHandler() {
      reverseLinkAction({ source: "toolbar" });
      return Promise.resolve();
    },
  };

  const customGraphAction = {
    icon: <ChartLineIcon />,
    applicable: true,
    priority: 2,
    label: translate("customGraph.menuTitle"),
    onSelect: openCustomGraph,
  };

  const onChangeActiveTopology = useCallback(() => {
    changeSelectedAssetsActiveTopologyStatus({ source: "toolbar" });
    return Promise.resolve();
  }, [changeSelectedAssetsActiveTopologyStatus]);

  const changeActiveTopologyActionItem = {
    icon: allActive ? <DeactivateTopologyIcon /> : <ActivateTopologyIcon />,
    applicable: true,
    priority: 4,
    disabled: readonly,
    label: allActive
      ? translate("deactivateAssets")
      : translate("activateAssets"),
    shortcut: changeActiveTopologyShortcut,
    onSelect: onChangeActiveTopology,
  };

  return [
    zoomToAction,
    reverseAction,
    redrawAction,
    changeActiveTopologyActionItem,
    customGraphAction,
    deleteAssetsAction,
  ];
}

export function LinkActions({ readonly = false }: { readonly?: boolean }) {
  const actions = useLinkActions(readonly);

  return <ActionsBar actions={actions} className="h-8 -my-2" />;
}
