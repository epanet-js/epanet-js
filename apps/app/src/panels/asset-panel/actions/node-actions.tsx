import { useCallback } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { useZoomToSelection } from "src/commands/zoom-to-selection";
import { useDeleteSelection } from "src/commands/delete-selection";
import { ChartLineIcon, DeleteIcon, ZoomToIcon } from "src/icons";
import { Action } from "src/components/action-button";
import { ActionsBar } from "src/components/actions-bar";
import { useCustomGraph } from "src/hooks/use-custom-graph";

export function useNodeActions(readonly = false): Action[] {
  const translate = useTranslate();
  const zoomToSelection = useZoomToSelection();
  const deleteSelection = useDeleteSelection();
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
    priority: 3,
    label: translate("zoomTo"),
    onSelect: function doZoomTo() {
      zoomToSelection({ source: "toolbar" });
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

  return [zoomToAction, customGraphAction, deleteAssetsAction];
}

export function NodeActions({ readonly = false }: { readonly?: boolean }) {
  const actions = useNodeActions(readonly);

  return <ActionsBar actions={actions} className="h-8 -my-2" />;
}
