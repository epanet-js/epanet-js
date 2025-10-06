import { useAtomValue } from "jotai";
import { selectedFeaturesAtom } from "src/state/jotai";
import { LinkActions } from "./link-actions";
import { NodeActions } from "./node-actions";

export function PanelActions() {
  const selectedWrappedFeatures = useAtomValue(selectedFeaturesAtom);

  if (selectedWrappedFeatures.length !== 1) return null;

  const asset = selectedWrappedFeatures[0];
  const isLink =
    asset.feature.properties?.type &&
    typeof asset.feature.properties.type === "string" &&
    ["pipe", "pump", "valve"].includes(asset.feature.properties.type);

  return isLink ? <LinkActions /> : <NodeActions />;
}
