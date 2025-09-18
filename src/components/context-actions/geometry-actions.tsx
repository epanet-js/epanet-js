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
import { DeleteIcon, EditVerticesIcon, ZoomToIcon } from "src/icons";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useSetAtom, useAtomValue } from "jotai";
import { ephemeralStateAtom } from "src/state/jotai";
import { Mode, modeAtom } from "src/state/mode";
import { Position } from "src/types";

export function useActions(
  selectedWrappedFeatures: IWrappedFeature[],
  source: ActionProps["as"],
): Action[] {
  const translate = useTranslate();
  const zoomTo = useZoomTo();
  const deleteSelectedAssets = useDeleteSelectedAssets();
  const isVerticesOn = useFeatureFlag("FLAG_VERTICES");
  const setMode = useSetAtom(modeAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const { mode: currentMode } = useAtomValue(modeAtom);

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

  const extractVertices = (coordinates: Position[]): Position[] => {
    return coordinates.slice(1, -1);
  };

  const editVerticesAction = {
    icon: <EditVerticesIcon />,
    applicable: Boolean(isVerticesOn && isOneLinkSelected),
    label: translate("editVertices"),
    selected: currentMode === Mode.EDIT_VERTICES,
    onSelect: function editVertices() {
      if (selectedWrappedFeatures.length === 1) {
        const feature = selectedWrappedFeatures[0];
        const geometry = feature.feature.geometry;

        if (geometry && geometry.type === "LineString") {
          const coordinates = geometry.coordinates;

          if (coordinates && coordinates.length > 2) {
            const vertices = extractVertices(coordinates);

            setEphemeralState({
              type: "editVertices",
              linkId: feature.id,
              vertices,
            });

            setMode({ mode: Mode.EDIT_VERTICES });
          }
        }
      }
      return Promise.resolve();
    },
  };

  return [zoomToAction, editVerticesAction, deleteAssetsAction];
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
