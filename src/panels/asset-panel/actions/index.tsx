import { useAtomValue } from "jotai";
import { selectedFeaturesAtom } from "src/state/selection";
import { selectedFeaturesDerivedAtom } from "src/state/derived-branch-state";
import { useIsSnapshotLocked } from "src/hooks/use-is-snapshot-locked";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { LinkActions } from "./link-actions";
import { NodeActions } from "./node-actions";

export function PanelActions() {
  const isStateRefactorOn = useFeatureFlag("FLAG_STATE_REFACTOR");
  const selectedWrappedFeatures = useAtomValue(
    isStateRefactorOn ? selectedFeaturesDerivedAtom : selectedFeaturesAtom,
  );
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
