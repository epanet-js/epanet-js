import type {
  Action,
  ActionProps,
} from "src/components/context-actions/action-item";
import { B3Variant } from "src/components/elements";
import { ActionItem } from "./action-item";
import { useCallback } from "react";
import { useZoomToSelection } from "src/commands/zoom-to-selection";
import { selectedAssetsDerivedAtom } from "src/state/derived-branch-state";
import { useTranslate } from "src/hooks/use-translate";
import { useDeleteSelection } from "src/commands/delete-selection";
import {
  useChangeSelectedAssetsActiveTopologyStatus,
  changeActiveTopologyShortcut,
} from "src/commands/change-selected-assets-active-topology-status";
import {
  DeleteIcon,
  ZoomToIcon,
  RedrawIcon,
  ReverseIcon,
  ActivateTopologyIcon,
  DeactivateTopologyIcon,
  ChartLineIcon,
} from "src/icons";
import { useAtomValue } from "jotai";
import { Mode, modeAtom } from "src/state/mode";
import { useSetRedrawMode } from "src/commands/set-redraw-mode";
import { useReverseLink } from "src/commands/reverse-link";
import { useCustomGraph } from "src/hooks/use-custom-graph";

export function GeometryActions({ as }: { as: ActionProps["as"] }) {
  const actions = useSelectionActions(as);

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

function useSelectionActions(source: ActionProps["as"]): Action[] {
  const translate = useTranslate();
  const zoomToSelection = useZoomToSelection();
  const deleteSelection = useDeleteSelection();
  const {
    changeSelectedAssetsActiveTopologyStatus: activateDeactivateAction,
    allActive,
  } = useChangeSelectedAssetsActiveTopologyStatus();
  const { mode: currentMode } = useAtomValue(modeAtom);
  const setRedrawMode = useSetRedrawMode();
  const reverseLinkAction = useReverseLink();
  const { openCustomGraph } = useCustomGraph();
  const selectedAssets = useAtomValue(selectedAssetsDerivedAtom);

  const hasAssets = selectedAssets.length > 0;

  const onDelete = useCallback(() => {
    const eventSource = source === "context-item" ? "context-menu" : "toolbar";
    deleteSelection({ source: eventSource });
    return Promise.resolve();
  }, [deleteSelection, source]);

  const deleteAssetsAction = {
    label: translate("delete"),
    variant: "danger-quiet" as B3Variant,
    applicable: true,
    icon: <DeleteIcon />,
    onSelect: onDelete,
  };

  const zoomToAction = {
    icon: <ZoomToIcon />,
    applicable: true,
    label: translate("zoomTo"),
    onSelect: function doZoomTo() {
      zoomToSelection({
        source: source === "context-item" ? "context-menu" : "toolbar",
      });
      return Promise.resolve();
    },
  };

  const isOneLinkSelected =
    selectedAssets.length === 1 &&
    selectedAssets[0].feature.properties?.type &&
    typeof selectedAssets[0].feature.properties.type === "string" &&
    ["pipe", "pump", "valve"].includes(
      selectedAssets[0].feature.properties.type,
    );

  const redrawAction = {
    icon: <RedrawIcon />,
    applicable: Boolean(isOneLinkSelected),
    label: translate("redraw"),
    selected: currentMode === Mode.REDRAW_LINK,
    onSelect: function redrawLink() {
      const eventSource =
        source === "context-item" ? "context-menu" : "toolbar";
      setRedrawMode({ source: eventSource });
      return Promise.resolve();
    },
  };

  const customGraphAction = {
    icon: <ChartLineIcon />,
    applicable: hasAssets,
    label: translate("customGraph.menuTitle"),
    onSelect: openCustomGraph,
  };

  const reverseAction = {
    icon: <ReverseIcon />,
    applicable: Boolean(isOneLinkSelected),
    label: translate("reverse"),
    onSelect: function reverseLinkActionHandler() {
      const eventSource =
        source === "context-item" ? "context-menu" : "toolbar";
      reverseLinkAction({ source: eventSource });
      return Promise.resolve();
    },
  };

  const changeActiveTopologyStatusAction = {
    icon: allActive ? <DeactivateTopologyIcon /> : <ActivateTopologyIcon />,
    applicable: hasAssets,
    label: allActive
      ? translate("deactivateAssets")
      : translate("activateAssets"),
    shortcut: changeActiveTopologyShortcut,
    onSelect: function activateDeactivateHandler() {
      const eventSource =
        source === "context-item" ? "context-menu" : "toolbar";
      activateDeactivateAction({ source: eventSource });
      return Promise.resolve();
    },
  };

  return [
    zoomToAction,
    reverseAction,
    redrawAction,
    changeActiveTopologyStatusAction,
    customGraphAction,
    deleteAssetsAction,
  ];
}
