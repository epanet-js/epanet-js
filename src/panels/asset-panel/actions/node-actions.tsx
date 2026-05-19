import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { useDeleteSelection } from "src/commands/delete-selection";
import { ChartLineIcon, DeleteIcon, ZoomToIcon } from "src/icons";
import {
  selectedFeaturesDerivedAtom,
  simulationDerivedAtom,
} from "src/state/derived-branch-state";
import { ActionButton, Action } from "src/components/action-button";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export function useNodeActions(readonly = false): Action[] {
  const translate = useTranslate();
  const zoomTo = useZoomTo();
  const deleteSelection = useDeleteSelection();
  const selectedWrappedFeatures = useAtomValue(selectedFeaturesDerivedAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const isCustomGraphsOn = useFeatureFlag("FLAG_CUSTOM_GRAPHS");
  const simulation = useAtomValue(simulationDerivedAtom);
  const customGraphApplicable = simulation.status === "success";

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

  const customGraphAction = {
    icon: <ChartLineIcon />,
    applicable: customGraphApplicable,
    label: translate("customGraph.menuTitle"),
    onSelect: function openCustomGraph() {
      setDialogState({ type: "customGraph" });
      return Promise.resolve();
    },
  };

  return isCustomGraphsOn
    ? [zoomToAction, customGraphAction, deleteAssetsAction]
    : [zoomToAction, deleteAssetsAction];
}

export function NodeActions({ readonly = false }: { readonly?: boolean }) {
  const actions = useNodeActions(readonly);

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
