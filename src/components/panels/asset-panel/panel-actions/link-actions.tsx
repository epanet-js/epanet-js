import { useCallback } from "react";
import { useAtomValue } from "jotai";
import { useTranslate } from "src/hooks/use-translate";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { useDeleteSelectedAssets } from "src/commands/delete-selected-assets";
import { useSetRedrawMode } from "src/commands/set-redraw-mode";
import { useReverseLink } from "src/commands/reverse-link";
import { DeleteIcon, ZoomToIcon, RedrawIcon, ReverseIcon } from "src/icons";
import { Mode, modeAtom, selectedFeaturesAtom } from "src/state/jotai";
import { ActionButton, Action } from "./action-button";

export function useLinkActions(): Action[] {
  const translate = useTranslate();
  const zoomTo = useZoomTo();
  const deleteSelectedAssets = useDeleteSelectedAssets();
  const { mode: currentMode } = useAtomValue(modeAtom);
  const setRedrawMode = useSetRedrawMode();
  const reverseLinkAction = useReverseLink();
  const selectedWrappedFeatures = useAtomValue(selectedFeaturesAtom);

  const onDelete = useCallback(() => {
    deleteSelectedAssets({ source: "toolbar" });
    return Promise.resolve();
  }, [deleteSelectedAssets]);

  const deleteAssetsAction = {
    label: translate("delete"),
    variant: "danger-quiet" as const,
    applicable: true,
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
    label: translate("reverse"),
    onSelect: function reverseLinkActionHandler() {
      reverseLinkAction({ source: "toolbar" });
      return Promise.resolve();
    },
  };

  return [zoomToAction, reverseAction, redrawAction, deleteAssetsAction];
}

export function LinkActions() {
  const actions = useLinkActions();

  return (
    <div className="flex gap-1">
      {actions
        .filter((action) => action.applicable)
        .map((action, i) => (
          <ActionButton key={i} action={action} />
        ))}
    </div>
  );
}
