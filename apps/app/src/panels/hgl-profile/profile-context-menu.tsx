"use client";
import { memo, useMemo } from "react";
import * as CM from "@radix-ui/react-context-menu";
import { useAtomValue, useSetAtom } from "jotai";
import { CMContent } from "src/components/elements";
import {
  ActionItem,
  type Action,
} from "src/components/context-actions/action-item";
import { useTranslate } from "src/hooks/use-translate";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection";
import { SelectPathIcon, ZoomToIcon } from "src/icons";

export const ProfileContextMenu = memo(function ProfileContextMenu({
  pathIds,
}: {
  pathIds: number[];
}) {
  const actions = useActions(pathIds);

  return (
    <CM.Portal>
      <CMContent>
        {actions
          .filter((action) => action.applicable)
          .map((action, i) => (
            <ActionItem as="context-item" key={i} action={action} />
          ))}
      </CMContent>
    </CM.Portal>
  );
});

function useActions(pathIds: number[]): Action[] {
  const translate = useTranslate();
  const zoomTo = useZoomTo();
  const selection = useAtomValue(selectionAtom);
  const setSelection = useSetAtom(selectionAtom);

  const isAllPathSelected = useMemo(() => {
    const selectedIds = USelection.getAssetIds(selection);
    if (selectedIds.length !== pathIds.length) return false;
    const selected = new Set(selectedIds);
    return pathIds.every((id) => selected.has(id));
  }, [selection, pathIds]);

  const pathSelection = useMemo(
    () => USelection.fromAssetIds(pathIds),
    [pathIds],
  );

  const zoomToAction: Action = {
    icon: <ZoomToIcon />,
    applicable: pathIds.length > 0,
    label: translate("zoomTo"),
    onSelect: () => {
      zoomTo(pathSelection);
      return Promise.resolve();
    },
  };

  const selectAllAction: Action = {
    icon: <SelectPathIcon />,
    applicable: pathIds.length > 0 && !isAllPathSelected,
    label: translate("hglProfile.selectPath"),
    onSelect: () => {
      setSelection(pathSelection);
      return Promise.resolve();
    },
  };

  return [zoomToAction, selectAllAction];
}
