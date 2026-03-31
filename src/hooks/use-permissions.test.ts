import { describe, it, expect } from "vitest";
import { resolvePermissions } from "./use-permissions";
import { Plan } from "src/user-plan";

describe("resolvePermissions", () => {
  it("free plan cannot use paid features but can upgrade", () => {
    const p = resolvePermissions("free");
    expect(p.canAddCustomLayers).toBe(false);
    expect(p.canUseScenarios).toBe(false);
    expect(p.canUseElevations).toBe(false);
    expect(p.canUpgrade).toBe(true);
  });

  it.each(["pro", "personal", "education"] satisfies Plan[])(
    "%s plan can use all features but cannot upgrade",
    (plan) => {
      const p = resolvePermissions(plan);
      expect(p.canAddCustomLayers).toBe(true);
      expect(p.canUseScenarios).toBe(true);
      expect(p.canUseElevations).toBe(true);
      expect(p.canUpgrade).toBe(false);
    },
  );
});
