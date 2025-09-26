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
import { DeleteIcon, ZoomToIcon, RedrawIcon, ReverseIcon } from "src/icons";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useSetAtom, useAtomValue } from "jotai";
import { ephemeralStateAtom, dataAtom } from "src/state/jotai";
import { Mode, modeAtom } from "src/state/mode";
import { LinkAsset, LinkType } from "src/hydraulic-model";
import { reverseLink } from "src/hydraulic-model/model-operations/reverse-link";
import { useUserTracking } from "src/infra/user-tracking";
import { usePersistence } from "src/lib/persistence/context";

export function useActions(
  selectedWrappedFeatures: IWrappedFeature[],
  source: ActionProps["as"],
): Action[] {
  const translate = useTranslate();
  const zoomTo = useZoomTo();
  const deleteSelectedAssets = useDeleteSelectedAssets();
  const isRedrawOn = useFeatureFlag("FLAG_REDRAW");
  const isReverseOn = useFeatureFlag("FLAG_REVERSE");
  const setMode = useSetAtom(modeAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const { mode: currentMode } = useAtomValue(modeAtom);
  const { hydraulicModel } = useAtomValue(dataAtom);
  const userTracking = useUserTracking();
  const rep = usePersistence();
  const transact = rep.useTransact();

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
    applicable: Boolean(isRedrawOn && isOneLinkSelected),
    label: translate("redraw"),
    selected: currentMode === Mode.REDRAW_LINK,
    onSelect: function redrawLink() {
      if (selectedWrappedFeatures.length === 1) {
        const feature = selectedWrappedFeatures[0];
        const linkType = feature.feature.properties?.type;

        if (
          typeof linkType === "string" &&
          ["pipe", "pump", "valve"].includes(linkType)
        ) {
          const selectedAsset = hydraulicModel.assets.get(
            feature.id,
          ) as LinkAsset;

          if (selectedAsset) {
            const eventSource =
              source === "context-item" ? "context-menu" : "toolbar";

            userTracking.capture({
              name: "asset.redrawStarted",
              source: eventSource,
              type: linkType as LinkAsset["type"],
            });

            setEphemeralState({
              type: "drawLink",
              linkType: linkType as LinkType,
              snappingCandidate: null,
              sourceLink: selectedAsset,
            });
          }

          setMode({ mode: Mode.REDRAW_LINK });
        }
      }
      return Promise.resolve();
    },
  };

  const reverseAction = {
    icon: <ReverseIcon />,
    applicable: Boolean(isReverseOn && isOneLinkSelected),
    label: translate("reverse"),
    onSelect: function reverseLinkAction() {
      if (selectedWrappedFeatures.length === 1) {
        const feature = selectedWrappedFeatures[0];
        const linkType = feature.feature.properties?.type;

        if (
          typeof linkType === "string" &&
          ["pipe", "pump", "valve"].includes(linkType)
        ) {
          const selectedAsset = hydraulicModel.assets.get(
            feature.id,
          ) as LinkAsset;

          if (selectedAsset) {
            const eventSource =
              source === "context-item" ? "context-menu" : "toolbar";

            userTracking.capture({
              name: "link.reversed",
              source: eventSource,
              type: linkType as LinkAsset["type"],
            });

            const moment = reverseLink(hydraulicModel, {
              linkId: selectedAsset.id,
            });

            transact(moment);
          }
        }
      }
      return Promise.resolve();
    },
  };

  return [zoomToAction, redrawAction, reverseAction, deleteAssetsAction];
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
