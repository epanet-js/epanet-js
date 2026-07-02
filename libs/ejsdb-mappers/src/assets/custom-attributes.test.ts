import { describe, it, expect } from "vitest";
import { presets } from "@epanet-js/project-settings";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";
import {
  AssetFactory,
  LabelManager,
  type Junction,
} from "@epanet-js/hydraulic-model";
import { customPropertyKey } from "@epanet-js/custom-attributes";
import {
  serializeAssetCustomAttributes,
  applyAssetCustomAttributes,
} from "./custom-attributes";

const makeJunction = (): Junction =>
  new AssetFactory(
    presets.LPS.defaults,
    new ConsecutiveIdsGenerator(),
    new LabelManager(),
  ).createJunction({ id: 1, label: "J1" });

describe("asset custom attributes mapper", () => {
  it("returns null when the asset has no custom attributes", () => {
    expect(serializeAssetCustomAttributes(makeJunction())).toBeNull();
  });

  it("serializes non-null custom values keyed by attribute id", () => {
    const junction = makeJunction();
    junction.setProperty(customPropertyKey("ca-1"), "north");
    junction.setProperty(customPropertyKey("ca-2"), 42);
    junction.setProperty(customPropertyKey("ca-3"), null);

    expect(serializeAssetCustomAttributes(junction)).toBe(
      JSON.stringify({ "ca-1": "north", "ca-2": 42 }),
    );
  });

  it("round-trips values through serialize then apply", () => {
    const source = makeJunction();
    source.setProperty(customPropertyKey("ca-1"), "north");
    source.setProperty(customPropertyKey("ca-2"), 42);

    const json = serializeAssetCustomAttributes(source);
    const target = makeJunction();
    applyAssetCustomAttributes(target, json);

    expect(target.getProperty(customPropertyKey("ca-1"))).toBe("north");
    expect(target.getProperty(customPropertyKey("ca-2"))).toBe(42);
  });

  it("is a no-op when applying null", () => {
    const target = makeJunction();
    applyAssetCustomAttributes(target, null);
    expect(target.hasProperty(customPropertyKey("ca-1"))).toBe(false);
  });
});
