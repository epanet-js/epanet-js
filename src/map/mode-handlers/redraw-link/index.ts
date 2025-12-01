import type { HandlerContext } from "src/types";
import { useDrawLinkHandlers, type SubmitLinkParams } from "../draw-link";
import { useAtomValue, useSetAtom } from "jotai";
import { selectionAtom, modeAtom, Mode } from "src/state/jotai";
import { Asset, LinkAsset, NodeAsset } from "src/hydraulic-model";
import { USelection, useSelection } from "src/selection";
import { replaceLink } from "src/hydraulic-model/model-operations";
import measureLength from "@turf/length";
import { useUserTracking } from "src/infra/user-tracking";

export function useRedrawLinkHandlers(
  handlerContext: HandlerContext,
): Handlers {
  const selection = useAtomValue(selectionAtom);
  const setMode = useSetAtom(modeAtom);
  const transact = handlerContext.rep.useTransact();
  const userTracking = useUserTracking();
  const { hydraulicModel } = handlerContext;
  const { assets } = hydraulicModel;
  const { selectAsset } = useSelection(selection);

  const selectedIds = USelection.toIds(selection);
  const selectedAssets = selectedIds
    .map((id) => assets.get(id))
    .filter((asset: Asset | undefined) => asset && asset.isLink === true);

  const selectedLink = selectedAssets[0] as LinkAsset;
  const sourceLink = selectedLink || undefined;

  const onSubmitLink = ({
    startNode,
    link,
    endNode,
    startPipeId,
    endPipeId,
  }: SubmitLinkParams) => {
    const length = measureLength(link.feature);
    if (!length) {
      return;
    }

    const moment = replaceLink(hydraulicModel, {
      sourceLinkId: sourceLink.id,
      startNode,
      endNode,
      startPipeId,
      endPipeId,
      newLink: link,
    });

    userTracking.capture({ name: "asset.redrawed", type: link.type });
    transact(moment);

    setMode({ mode: Mode.NONE });

    if (moment.putAssets && moment.putAssets.length > 0) {
      const newLinkId = moment.putAssets[0].id;
      selectAsset(newLinkId);
    }

    const [, , endNodeUpdated] = moment.putAssets || [];
    return endNodeUpdated as NodeAsset;
  };

  return useDrawLinkHandlers({
    ...handlerContext,
    linkType: selectedLink ? selectedLink.type : "pipe",
    sourceLink,
    onSubmitLink,
    disableEndAndContinue: true,
  });
}
