import { useAtomValue } from "jotai";
import { selectedAssetsDerivedAtom } from "src/state/derived-branch-state";
import { useIsEditionBlocked } from "src/hooks/use-is-edition-blocked";
import { LinkActions } from "./link-actions";
import { NodeActions } from "./node-actions";

export function PanelActions() {
  const selectedAssets = useAtomValue(selectedAssetsDerivedAtom);
  const isEditionBlocked = useIsEditionBlocked();

  if (selectedAssets.length !== 1) return null;

  const asset = selectedAssets[0];
  const isLink =
    asset.feature.properties?.type &&
    typeof asset.feature.properties.type === "string" &&
    ["pipe", "pump", "valve"].includes(asset.feature.properties.type);

  return isLink ? (
    <LinkActions readonly={isEditionBlocked} />
  ) : (
    <NodeActions readonly={isEditionBlocked} />
  );
}
