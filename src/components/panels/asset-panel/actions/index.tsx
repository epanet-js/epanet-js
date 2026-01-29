import { useAtomValue } from "jotai";
import { selectedFeaturesAtom } from "src/state/jotai";
import { useIsSnapshotLocked } from "src/hooks/use-is-snapshot-locked";
import { LinkActions } from "./link-actions";
import { NodeActions } from "./node-actions";

export function PanelActions() {
  const selectedWrappedFeatures = useAtomValue(selectedFeaturesAtom);
  const isSnapshotLocked = useIsSnapshotLocked();

  if (selectedWrappedFeatures.length !== 1) return null;

  const asset = selectedWrappedFeatures[0];
  const isLink =
    asset.feature.properties?.type &&
    typeof asset.feature.properties.type === "string" &&
    ["pipe", "pump", "valve"].includes(asset.feature.properties.type);

  return isLink ? (
    <LinkActions readonly={isSnapshotLocked} />
  ) : (
    <NodeActions readonly={isSnapshotLocked} />
  );
}
