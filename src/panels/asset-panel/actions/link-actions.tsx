import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { useZoomTo } from "src/hooks/use-zoom-to";
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
import {
  selectedFeaturesDerivedAtom,
  simulationDerivedAtom,
} from "src/state/derived-branch-state";
import { ActionButton, Action } from "src/components/action-button";
import {
  changeActiveTopologyShortcut,
  useChangeSelectedAssetsActiveTopologyStatus,
} from "src/commands/change-selected-assets-active-topology-status";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export function useLinkActions(readonly = false): Action[] {
  const translate = useTranslate();
  const zoomTo = useZoomTo();
  const deleteSelection = useDeleteSelection();
  const { mode: currentMode } = useAtomValue(modeAtom);
  const setRedrawMode = useSetRedrawMode();
  const reverseLinkAction = useReverseLink();
  const selectedWrappedFeatures = useAtomValue(selectedFeaturesDerivedAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const { changeSelectedAssetsActiveTopologyStatus, allActive } =
    useChangeSelectedAssetsActiveTopologyStatus();
  const isCustomGraphsOn = useFeatureFlag("FLAG_CUSTOM_GRAPHS");
  const simulation = useAtomValue(simulationDerivedAtom);
  const customGraphApplicable =
    simulation.status === "success" || simulation.status === "warning";

  const onDelete = useCallback(() => {
    deleteSelection({ source: "toolbar" });
    return Promise.resolve();
  }, [deleteSelection]);

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

  const redrawAction = {
    icon: <RedrawIcon />,
    applicable: true,
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
    disabled: readonly,
    label: translate("reverse"),
    onSelect: function reverseLinkActionHandler() {
      reverseLinkAction({ source: "toolbar" });
      return Promise.resolve();
    },
  };

  const customGraphAction = {
    icon: <ChartLineIcon />,
    applicable: customGraphApplicable,
    label: translate("customGraph.menuTitle"),
    onSelect: function openCustomGraph() {
      setDialogState({ type: "customGraph" });
      return Promise.resolve();
    },
  };

  const onChangeActiveTopology = useCallback(() => {
    changeSelectedAssetsActiveTopologyStatus({ source: "toolbar" });
    return Promise.resolve();
  }, [changeSelectedAssetsActiveTopologyStatus]);

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
        reverseAction,
        redrawAction,
        changeActiveTopologyActionItem,
        customGraphAction,
        deleteAssetsAction,
      ]
    : [
        zoomToAction,
        reverseAction,
        redrawAction,
        changeActiveTopologyActionItem,
        deleteAssetsAction,
      ];
}

export function LinkActions({ readonly = false }: { readonly?: boolean }) {
  const actions = useLinkActions(readonly);

  return (
    <div className="flex gap-1 h-8 -my-2">
      {actions
        .filter((action) => action.applicable)
        .map((action, i) => (
          <ActionButton key={i} action={action} />
        ))}
    </div>
  );
}
