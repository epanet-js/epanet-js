import { EXTENDED_ASSET_LABEL_MAX_BYTES } from "@epanet-js/hydraulic-model";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const useAssetLabelMaxBytes = (): number | undefined => {
  const isExportLabelsOn = useFeatureFlag("FLAG_EXPORT_LABELS");
  return isExportLabelsOn ? EXTENDED_ASSET_LABEL_MAX_BYTES : undefined;
};
