import { describe, it, expect } from "vitest";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";
import {
  AssetFactory,
  LabelManager,
  type Junction,
} from "@epanet-js/hydraulic-model";
import {
  serializeAssetCustomAttributes,
  applyAssetCustomAttributes,
} from "./custom-attributes";

const makeJunction = (): Junction =>
  new AssetFactory(
    new ConsecutiveIdsGenerator(),
    new LabelManager(),
  ).createJunction({ id: 1, label: "J1" });

describe("asset custom attributes mapper", () => {
  it("returns null when the asset has no custom attributes", () => {
    expect(serializeAssetCustomAttributes(makeJunction())).toBeNull();
  });

  it("serializes non-null custom values keyed by attribute id", () => {
    const junction = makeJunction();
    junction.setProperty("custom-1", "north");
    junction.setProperty("custom-2", 42);
    junction.setProperty("custom-3", null);

    expect(serializeAssetCustomAttributes(junction)).toBe(
      JSON.stringify({ "custom-1": "north", "custom-2": 42 }),
    );
  });

  it("round-trips values through serialize then apply", () => {
    const source = makeJunction();
    source.setProperty("custom-1", "north");
    source.setProperty("custom-2", 42);

    const json = serializeAssetCustomAttributes(source);
    const target = makeJunction();
    applyAssetCustomAttributes(target, json);

    expect(target.getProperty("custom-1")).toBe("north");
    expect(target.getProperty("custom-2")).toBe(42);
  });

  it("is a no-op when applying null", () => {
    const target = makeJunction();
    applyAssetCustomAttributes(target, null);
    expect(target.hasProperty("custom-1")).toBe(false);
  });
});
