import React from "react";
import { WizardState, WizardActions } from "./types";
import { UnitsSpec } from "src/model-metadata/quantities-spec";
import { DataMappingStepNew } from "./data-mapping-step-new";

export const DataMappingStep: React.FC<{
  onNext: () => void;
  onBack: () => void;
  wizardState: WizardState & WizardActions & { units: UnitsSpec };
}> = (props) => {
  return <DataMappingStepNew {...props} />;
};
