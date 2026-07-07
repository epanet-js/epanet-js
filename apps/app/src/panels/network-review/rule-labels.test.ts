import { describe, it, expect } from "vitest";
import { RULES } from "src/lib/model-attributes-validation";
import { ruleLabelKey } from "./rule-labels";
import i18n from "src/infra/i18n/i18next-config";

describe("model attributes validation rule translations", () => {
  it("has a translation for every validation rule", () => {
    const missing = RULES.map((rule) => rule.id).filter(
      (id) => !i18n.exists(ruleLabelKey(id)),
    );

    expect(missing).toEqual([]);
  });

  it("reports a rule id that has no translation as missing", () => {
    // Guards the check above from silently passing if key lookup ever changed.
    expect(i18n.exists(ruleLabelKey("pipe.nonexistent.check"))).toBe(false);
  });
});
