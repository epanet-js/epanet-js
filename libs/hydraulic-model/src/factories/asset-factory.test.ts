import { describe, it, expect } from "vitest";
import { buildPipe } from "../test-helpers";

describe("AssetFactory createPipe roughness", () => {
  it("applies the default roughness when none is provided", () => {
    expect(buildPipe({}).roughness).toEqual(130);
  });

  it("keeps the provided roughness value", () => {
    expect(buildPipe({ roughness: 95 }).roughness).toEqual(95);
  });

  it("leaves roughness empty when explicitly null", () => {
    expect(buildPipe({ roughness: null }).roughness).toBeNull();
  });
});
