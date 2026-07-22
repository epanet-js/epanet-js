import { EXTENDED_LABEL_MAX_LENGTH } from "@epanet-js/hydraulic-model";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const useLabelMaxLength = (): number | undefined => {
  const isExportLabelsOn = useFeatureFlag("FLAG_EXPORT_LABELS");
  return isExportLabelsOn ? EXTENDED_LABEL_MAX_LENGTH : undefined;
};
