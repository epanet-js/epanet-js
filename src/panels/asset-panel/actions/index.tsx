import { useAtomValue } from "jotai";
import { selectedFeaturesDerivedAtom } from "src/state/derived-branch-state";
import { useIsBranchLocked } from "src/hooks/use-is-branch-locked";
import { LinkActions } from "./link-actions";
import { NodeActions } from "./node-actions";

export function PanelActions() {
  const selectedWrappedFeatures = useAtomValue(selectedFeaturesDerivedAtom);
  const isBranchLocked = useIsBranchLocked();

  if (selectedWrappedFeatures.length !== 1) return null;

  const asset = selectedWrappedFeatures[0];
  const isLink =
    asset.feature.properties?.type &&
    typeof asset.feature.properties.type === "string" &&
    ["pipe", "pump", "valve"].includes(asset.feature.properties.type);

  return isLink ? (
    <LinkActions readonly={isBranchLocked} />
  ) : (
    <NodeActions readonly={isBranchLocked} />
  );
}
