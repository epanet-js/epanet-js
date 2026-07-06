import { render } from "@testing-library/react";
import { usePaywall } from "./use-paywall";
import type { Permissions } from "./use-permissions";

const defaultPermissions: Permissions = {
  canAddCustomLayers: false,
  canUseScenarios: false,
  canUseElevations: false,
  canUseZones: false,
  canUseControls: false,
  canUsePipeAttributes: false,
  canUseModelBuildV2: false,
  canValidateModelAttributes: false,
  canUsePipeLibrary: false,
  canUseCustomAttributes: false,
  canUpgrade: true,
  canManageOrganization: false,
};

const permissionsRef: { current: Permissions } = {
  current: defaultPermissions,
};

vi.mock("src/hooks/use-permissions", async () => {
  const actual = await vi.importActual<
    typeof import("src/hooks/use-permissions")
  >("src/hooks/use-permissions");
  return {
    ...actual,
    usePermissions: () => permissionsRef.current,
  };
});

const captureDialog = (feature: Parameters<typeof usePaywall>[0]) => {
  let result: ReturnType<typeof usePaywall> | undefined;
  const Probe = () => {
    result = usePaywall(feature);
    return null;
  };
  render(<Probe />);
  return result;
};

describe("usePaywall", () => {
  beforeEach(() => {
    permissionsRef.current = { ...defaultPermissions };
  });

  it("returns null when the user has the matching permission", () => {
    permissionsRef.current = {
      ...defaultPermissions,
      canUsePipeAttributes: true,
    };
    expect(captureDialog("pipeAttributes")).toBeNull();
  });

  it("returns the upgrade dialog for pipeAttributes when locked", () => {
    expect(captureDialog("pipeAttributes")).toEqual({
      type: "upgrade",
      source: { kind: "paywall", feature: "pipeAttributes" },
    });
  });

  it("returns the featurePaywall dialog for scenarios when locked", () => {
    expect(captureDialog("scenarios")).toEqual({
      type: "featurePaywall",
      feature: "scenarios",
    });
  });

  it("returns the featurePaywall dialog for elevations when locked", () => {
    expect(captureDialog("elevations")).toEqual({
      type: "featurePaywall",
      feature: "elevations",
    });
  });

  it("returns the featurePaywall dialog for customLayers when locked", () => {
    expect(captureDialog("customLayers")).toEqual({
      type: "featurePaywall",
      feature: "customLayers",
    });
  });

  it("returns null for customAttributes when the user has the permission", () => {
    permissionsRef.current = {
      ...defaultPermissions,
      canUseCustomAttributes: true,
    };
    expect(captureDialog("customAttributes")).toBeNull();
  });

  it("returns the featurePaywall dialog for customAttributes when locked", () => {
    expect(captureDialog("customAttributes")).toEqual({
      type: "featurePaywall",
      feature: "customAttributes",
    });
  });
});
