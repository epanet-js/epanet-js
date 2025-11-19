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
import { useDeleteSelectedAssets } from "src/commands/delete-selected-assets";
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
} from "src/icons";
import { useAtomValue } from "jotai";
import { Mode, modeAtom } from "src/state/mode";
import { useSetRedrawMode } from "src/commands/set-redraw-mode";
import { useReverseLink } from "src/commands/reverse-link";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export function useActions(
  selectedWrappedFeatures: IWrappedFeature[],
  source: ActionProps["as"],
): Action[] {
  const translate = useTranslate();
  const zoomTo = useZoomTo();
  const deleteSelectedAssets = useDeleteSelectedAssets();
  const {
    changeSelectedAssetsActiveTopologyStatus: activateDeactivateAction,
    allActive,
  } = useChangeSelectedAssetsActiveTopologyStatus();
  const { mode: currentMode } = useAtomValue(modeAtom);
  const setRedrawMode = useSetRedrawMode();
  const reverseLinkAction = useReverseLink();
  const isBulkActiveTopologyEnabled = useFeatureFlag(
    "FLAG_BULK_ACTIVE_TOPOLOGY",
  );

  const onDelete = useCallback(() => {
    const eventSource = source === "context-item" ? "context-menu" : "toolbar";
    deleteSelectedAssets({ source: eventSource });
    return Promise.resolve();
  }, [deleteSelectedAssets, source]);

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

  return isBulkActiveTopologyEnabled
    ? [
        zoomToAction,
        reverseAction,
        redrawAction,
        changeActiveTopologyStatusAction,
        deleteAssetsAction,
      ]
    : [zoomToAction, reverseAction, redrawAction, deleteAssetsAction];
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
