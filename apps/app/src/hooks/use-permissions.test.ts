import { describe, it, expect } from "vitest";
import { resolvePermissions } from "./use-permissions";
import { Plan } from "src/lib/account-plans";

describe("resolvePermissions", () => {
  it("free plan cannot use paid features but can upgrade", () => {
    const p = resolvePermissions("free", false, false, false);
    expect(p.canAddCustomLayers).toBe(false);
    expect(p.canUseScenarios).toBe(false);
    expect(p.canUseElevations).toBe(false);
    expect(p.canUseHglProfile).toBe(false);
    expect(p.canUseCustomGraphs).toBe(false);
    expect(p.canUseZones).toBe(false);
    expect(p.canUsePipeAttributes).toBe(false);
    expect(p.canUpgrade).toBe(true);
    expect(p.canManageOrganization).toBe(false);
  });

  it.each(["pro", "personal", "teams"] satisfies Plan[])(
    "%s plan can use all features (including early access) but cannot upgrade",
    (plan) => {
      const p = resolvePermissions(plan, false, false, false);
      expect(p.canAddCustomLayers).toBe(true);
      expect(p.canUseScenarios).toBe(true);
      expect(p.canUseElevations).toBe(true);
      expect(p.canUseHglProfile).toBe(true);
      expect(p.canUseCustomGraphs).toBe(true);
      expect(p.canUseZones).toBe(true);
      expect(p.canUsePipeAttributes).toBe(true);
      expect(p.canUpgrade).toBe(false);
      expect(p.canManageOrganization).toBe(false);
    },
  );

  it("education plan has paid features but not early-access features", () => {
    const p = resolvePermissions("education", false, false, false);
    expect(p.canAddCustomLayers).toBe(true);
    expect(p.canUseScenarios).toBe(true);
    expect(p.canUseElevations).toBe(true);
    expect(p.canUseHglProfile).toBe(false);
    expect(p.canUseCustomGraphs).toBe(false);
    expect(p.canUseZones).toBe(true);
    expect(p.canUsePipeAttributes).toBe(true);
    expect(p.canUpgrade).toBe(false);
    expect(p.canManageOrganization).toBe(false);
  });

  it("free plan with active trial can use paid features but can still upgrade", () => {
    const p = resolvePermissions("free", true, false, false);
    expect(p.canAddCustomLayers).toBe(true);
    expect(p.canUseScenarios).toBe(true);
    expect(p.canUseElevations).toBe(true);
    expect(p.canUseHglProfile).toBe(true);
    expect(p.canUseCustomGraphs).toBe(true);
    expect(p.canUseZones).toBe(true);
    expect(p.canUsePipeAttributes).toBe(true);
    expect(p.canUseModelBuildV2).toBe(true);
    expect(p.canUpgrade).toBe(true);
    expect(p.canManageOrganization).toBe(false);
  });

  it("free plan on a demo network can use pipe attributes but no other paid features", () => {
    const p = resolvePermissions("free", false, false, true);
    expect(p.canUsePipeAttributes).toBe(true);
    expect(p.canAddCustomLayers).toBe(false);
    expect(p.canUseScenarios).toBe(false);
    expect(p.canUseElevations).toBe(false);
    expect(p.canUpgrade).toBe(true);
  });

  it.each(["pro", "teams"] satisfies Plan[])(
    "%s plan can use the v2 model builder",
    (plan) => {
      expect(
        resolvePermissions(plan, false, false, false).canUseModelBuildV2,
      ).toBe(true);
    },
  );

  it.each(["free", "personal", "education"] satisfies Plan[])(
    "%s plan cannot use the v2 model builder",
    (plan) => {
      expect(
        resolvePermissions(plan, false, false, false).canUseModelBuildV2,
      ).toBe(false);
    },
  );

  it("org admin can manage organization", () => {
    const p = resolvePermissions("teams", false, true, false);
    expect(p.canManageOrganization).toBe(true);
  });

  it("non-admin cannot manage organization", () => {
    const p = resolvePermissions("teams", false, false, false);
    expect(p.canManageOrganization).toBe(false);
  });
});
