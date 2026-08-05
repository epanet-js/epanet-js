import { useFeatureFlag } from "src/hooks/use-feature-flags";
import {
  RULES,
  RULES_WITH_INFERRED_ROUGHNESS,
  type Rule,
} from "src/lib/model-attributes-validation";

export const useValidationRules = (): Rule[] => {
  const isInferRoughnessOn = useFeatureFlag("FLAG_INFER_ROUGHNESS");

  return isInferRoughnessOn ? RULES_WITH_INFERRED_ROUGHNESS : RULES;
};
