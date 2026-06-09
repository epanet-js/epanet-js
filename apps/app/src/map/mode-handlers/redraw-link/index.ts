import type { HandlerContext } from "src/types";
import { useDrawLinkHandlers, type SubmitLinkParams } from "../draw-link";
import { useAtomValue, useSetAtom } from "jotai";
import { modeAtom, Mode } from "src/state/mode";
import { selectionAtom } from "src/state/selection";
import { LinkAsset, NodeAsset } from "src/hydraulic-model";
import { USelection, useSelection } from "src/selection";
import { replaceLink } from "src/hydraulic-model/model-operations";
import { modelFactoriesAtom } from "src/state/model-factories";
import measureLength from "@turf/length";
import { useUserTracking } from "src/infra/user-tracking";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";

export function useRedrawLinkHandlers(
  handlerContext: HandlerContext,
): Handlers {
  const selection = useAtomValue(selectionAtom);
  const setMode = useSetAtom(modeAtom);
  const { transact } = useModelTransaction();
  const userTracking = useUserTracking();
  const { hydraulicModel } = handlerContext;
  const { assets } = hydraulicModel;
  const { assetFactory, labelManager } = useAtomValue(modelFactoriesAtom);
  const { selectAsset } = useSelection(selection);

  const selectedIds = USelection.getAssetIds(selection);
  const selectedLinkId = selectedIds.find((id) => {
    const asset = assets.get(id);
    return asset && asset.isLink === true;
  });
  const selectedLink = selectedLinkId
    ? (assets.get(selectedLinkId) as LinkAsset)
    : undefined;

  const sourceLink = selectedLink || undefined;

  const onSubmitLink = ({
    startNode,
    link,
    endNode,
    startPipeId,
    endPipeId,
  }: SubmitLinkParams) => {
    const length = measureLength(link.feature);
    if (!length || !sourceLink) {
      return;
    }

    const moment = replaceLink(hydraulicModel, {
      sourceLinkId: sourceLink.id,
      startNode,
      endNode,
      startPipeId,
      endPipeId,
      newLink: link,
      lengthUnit: handlerContext.units.length,
      assetFactory,
      labelManager,
      precision: handlerContext.map.getPrecision(),
    });

    const applied = transact(moment);

    setMode({ mode: Mode.NONE });

    if (!applied) return undefined;

    userTracking.capture({ name: "asset.redrawed", type: link.type });

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
