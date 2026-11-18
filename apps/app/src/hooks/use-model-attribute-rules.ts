import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { RULES_DEPRECATED, Rule } from "src/lib/model-attributes-validation";

export const useModelAttributeRules = (): Rule[] | undefined => {
  const isModelValidationsOn = useFeatureFlag("FLAG_MODEL_VALIDATIONS");
  return isModelValidationsOn ? undefined : RULES_DEPRECATED;
};
