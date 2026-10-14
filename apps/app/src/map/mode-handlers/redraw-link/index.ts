import type { HandlerContext } from "src/types";
import { useDrawLinkHandlers, type SubmitLinkParams } from "../draw-link";
import { useAtomValue, useSetAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { modeAtom, Mode } from "src/state/mode";
import { selectionAtom } from "src/state/selection";
import { LinkAsset, NodeAsset } from "src/hydraulic-model";
import { USelection, useSelection } from "src/selection";
import { replaceLink } from "src/hydraulic-model/model-operations";
import { modelFactoriesAtom } from "src/state/model-factories";
import measureLength from "@turf/length";
import { useUserTracking } from "src/infra/user-tracking";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";

export function useRedrawLinkHandlers(
  handlerContext: HandlerContext,
): Handlers {
  const selection = useAtomValue(selectionAtom);
  const setMode = useSetAtom(modeAtom);
  const { transact } = useModelTransaction();
  const readCommittedModel = useAtomCallback(
    useCallback((get) => get(stagingModelDerivedAtom), []),
  );
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

    const data = {
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
    };

    const applied = transact(() => replaceLink(hydraulicModel, data));

    setMode({ mode: Mode.NONE });

    if (!applied) return undefined;

    userTracking.capture({ name: "asset.redrawed", type: link.type });

    selectAsset(link.id);

    return readCommittedModel().assets.get(endNode.id) as NodeAsset | undefined;
  };

  return useDrawLinkHandlers({
    ...handlerContext,
    linkType: selectedLink ? selectedLink.type : "pipe",
    sourceLink,
    onSubmitLink,
    disableEndAndContinue: true,
  });
}
