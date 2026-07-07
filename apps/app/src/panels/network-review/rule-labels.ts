// Rule ids map to a camelCase translation key under the rule namespace, e.g.
// "pipe.diameter.present" -> "...rule.pipeDiameterPresent". Every rule in
// lib/model-attributes-validation/rules.ts must have a matching entry (see
// rule-labels.test.ts, which enforces this parity).
export const toRuleLabelToken = (ruleId: string) =>
  ruleId
    .split(".")
    .map((part, index) =>
      index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join("");

export const ruleLabelKey = (ruleId: string) =>
  `networkReview.modelAttributesValidation.rule.${toRuleLabelToken(ruleId)}`;
