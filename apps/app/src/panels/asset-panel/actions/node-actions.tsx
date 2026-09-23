import { useCallback } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { useZoomToSelection } from "src/commands/zoom-to-selection";
import { useDeleteSelection } from "src/commands/delete-selection";
import { BookmarkIcon, ChartLineIcon, DeleteIcon, ZoomToIcon } from "src/icons";
import { Action } from "src/components/action-button";
import { ActionsBar } from "src/components/actions-bar";
import { useCustomGraph } from "src/hooks/use-custom-graph";
import {
  useIsCollectionsAvailable,
  useStartCollectionDraft,
} from "src/commands/collection-draft";

export function useNodeActions(readonly = false): Action[] {
  const translate = useTranslate();
  const zoomToSelection = useZoomToSelection();
  const deleteSelection = useDeleteSelection();
  const { openCustomGraph } = useCustomGraph();
  const startCollectionDraft = useStartCollectionDraft();
  const isCollectionsAvailable = useIsCollectionsAvailable();

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

  const saveSelectionSetAction = {
    icon: <BookmarkIcon />,
    applicable: isCollectionsAvailable,
    label: translate("collections.selectionSets.save"),
    onSelect: function saveSelectionSet() {
      startCollectionDraft({ kind: "selectionSets", source: "toolbar" });
      return Promise.resolve();
    },
  };

  return [
    zoomToAction,
    saveSelectionSetAction,
    customGraphAction,
    deleteAssetsAction,
  ];
}

export function NodeActions({ readonly = false }: { readonly?: boolean }) {
  const actions = useNodeActions(readonly);

  return <ActionsBar actions={actions} className="h-8 -my-2" />;
}
