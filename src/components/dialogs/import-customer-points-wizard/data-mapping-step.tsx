import React from "react";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { WizardState, WizardActions } from "./types";
import { UnitsSpec } from "src/model-metadata/quantities-spec";
import { DataMappingStepNew } from "./data-mapping-step-new";
import { DataMappingStepDeprecated } from "./data-mapping-step-deprecated";

export const DataMappingStep: React.FC<{
  onNext: () => void;
  onBack: () => void;
  wizardState: WizardState & WizardActions & { units: UnitsSpec };
}> = (props) => {
  const isDataMappingOn = useFeatureFlag("FLAG_DATA_MAPPING");

  if (isDataMappingOn) {
    return <DataMappingStepNew {...props} />;
  }

  return <DataMappingStepDeprecated {...props} />;
};
