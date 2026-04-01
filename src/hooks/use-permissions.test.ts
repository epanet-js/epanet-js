import { describe, it, expect } from "vitest";
import { resolvePermissions } from "./use-permissions";
import { Plan } from "src/lib/account-plans";

describe("resolvePermissions", () => {
  it("free plan cannot use paid features but can upgrade", () => {
    const p = resolvePermissions("free", false);
    expect(p.canAddCustomLayers).toBe(false);
    expect(p.canUseScenarios).toBe(false);
    expect(p.canUseElevations).toBe(false);
    expect(p.canUpgrade).toBe(true);
  });

  it.each(["pro", "personal", "education", "teams"] satisfies Plan[])(
    "%s plan can use all features but cannot upgrade",
    (plan) => {
      const p = resolvePermissions(plan, false);
      expect(p.canAddCustomLayers).toBe(true);
      expect(p.canUseScenarios).toBe(true);
      expect(p.canUseElevations).toBe(true);
      expect(p.canUpgrade).toBe(false);
    },
  );

  it("free plan with active trial can use paid features but can still upgrade", () => {
    const p = resolvePermissions("free", true);
    expect(p.canAddCustomLayers).toBe(true);
    expect(p.canUseScenarios).toBe(true);
    expect(p.canUseElevations).toBe(true);
    expect(p.canUpgrade).toBe(true);
  });
});
