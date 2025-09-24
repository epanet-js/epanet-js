import type { HandlerContext } from "src/types";
import { useDrawLinkHandlers } from "../draw-link";
import { useAtomValue } from "jotai";
import { selectionAtom } from "src/state/jotai";
import { Asset, LinkAsset } from "src/hydraulic-model";
import { USelection } from "src/selection";

export function useRedrawLinkHandlers(
  handlerContext: HandlerContext,
): Handlers {
  const selection = useAtomValue(selectionAtom);
  const { assets } = handlerContext.hydraulicModel;

  const selectedIds = USelection.toIds(selection);
  const selectedAssets = selectedIds
    .map((id) => assets.get(id))
    .filter((asset: Asset | undefined) => asset && asset.isLink === true);

  const selectedLink = selectedAssets[0] as LinkAsset;
  const previousLink = selectedLink || undefined;

  return useDrawLinkHandlers({
    ...handlerContext,
    linkType: selectedLink ? selectedLink.type : "pipe",
    previousLink,
  });
}
