import { useCallback } from "react";
import { useAtomValue } from "jotai";
import { useTranslate } from "src/hooks/use-translate";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { useDeleteSelection } from "src/commands/delete-selection";
import { ChartLineIcon, DeleteIcon, ZoomToIcon } from "src/icons";
import { selectedFeaturesDerivedAtom } from "src/state/derived-branch-state";
import { ActionButton, Action } from "src/components/action-button";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useCustomGraph } from "src/hooks/use-custom-graph";
import { useUserTracking } from "src/infra/user-tracking";

export function useNodeActions(readonly = false): Action[] {
  const translate = useTranslate();
  const zoomTo = useZoomTo();
  const deleteSelection = useDeleteSelection();
  const selectedWrappedFeatures = useAtomValue(selectedFeaturesDerivedAtom);
  const isCustomGraphsOn = useFeatureFlag("FLAG_CUSTOM_GRAPHS");
  const { openCustomGraph } = useCustomGraph();
  const userTracking = useUserTracking();

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
      userTracking.capture({
        name: "selection.zoomedTo",
        source: "asset-panel",
        count: selectedWrappedFeatures.length,
      });
      return Promise.resolve(zoomTo(selectedWrappedFeatures));
    },
  };

  const customGraphAction = {
    icon: <ChartLineIcon />,
    applicable: true,
    label: translate("customGraph.menuTitle"),
    onSelect: openCustomGraph,
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
