import type {
  Action,
  ActionProps,
} from "src/components/context-actions/action-item";
import { B3Variant } from "src/components/elements";
import { ActionItem } from "./action-item";
import { useCallback } from "react";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { IWrappedFeature } from "src/types";
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
import { useAtomValue, useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { Mode, modeAtom } from "src/state/mode";
import { useSetRedrawMode } from "src/commands/set-redraw-mode";
import { useReverseLink } from "src/commands/reverse-link";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useShowPriorityAccessDialog } from "src/hooks/use-priority-access";
import { usePermissions } from "src/hooks/use-permissions";

export function useActions(
  selectedWrappedFeatures: IWrappedFeature[],
  source: ActionProps["as"],
): Action[] {
  const translate = useTranslate();
  const zoomTo = useZoomTo();
  const deleteSelection = useDeleteSelection();
  const {
    changeSelectedAssetsActiveTopologyStatus: activateDeactivateAction,
    allActive,
  } = useChangeSelectedAssetsActiveTopologyStatus();
  const { mode: currentMode } = useAtomValue(modeAtom);
  const setRedrawMode = useSetRedrawMode();
  const reverseLinkAction = useReverseLink();
  const setDialogState = useSetAtom(dialogAtom);
  const isCustomGraphsOn = useFeatureFlag("FLAG_CUSTOM_GRAPHS");
  const showPriorityAccess = useShowPriorityAccessDialog();
  const { canUseCustomGraphs } = usePermissions();

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
    onSelect: function doAddInnerRing() {
      return Promise.resolve(zoomTo(selectedWrappedFeatures));
    },
  };

  const isOneLinkSelected =
    selectedWrappedFeatures.length === 1 &&
    selectedWrappedFeatures[0].feature.properties?.type &&
    typeof selectedWrappedFeatures[0].feature.properties.type === "string" &&
    ["pipe", "pump", "valve"].includes(
      selectedWrappedFeatures[0].feature.properties.type,
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
    applicable: true,
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

  return isCustomGraphsOn
    ? [
        zoomToAction,
        reverseAction,
        redrawAction,
        changeActiveTopologyStatusAction,
        customGraphAction,
        deleteAssetsAction,
      ]
    : [
        zoomToAction,
        reverseAction,
        redrawAction,
        changeActiveTopologyStatusAction,
        deleteAssetsAction,
      ];
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
