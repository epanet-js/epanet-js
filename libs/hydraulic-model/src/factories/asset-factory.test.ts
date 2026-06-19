import { describe, it, expect } from "vitest";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";
import { AssetFactory, AssetFactoryWithNullValues } from "./asset-factory";
import { LabelManager } from "../label-manager";
import { testDefaults } from "../test-helpers/defaults";

const assetFactory = () =>
  new AssetFactory(
    testDefaults,
    new ConsecutiveIdsGenerator(),
    new LabelManager(),
  );

const assetFactoryWithNullValues = () =>
  new AssetFactoryWithNullValues(
    testDefaults,
    new ConsecutiveIdsGenerator(),
    new LabelManager(),
  );

describe("AssetFactory createPipe roughness", () => {
  it("applies the default roughness when none is provided", () => {
    expect(assetFactory().createPipe({}).roughness).toEqual(130);
  });

  it("keeps the provided roughness value", () => {
    expect(assetFactory().createPipe({ roughness: 95 }).roughness).toEqual(95);
  });
});

describe("AssetFactoryWithNullValues createPipe roughness", () => {
  it("leaves roughness empty when none is provided", () => {
    expect(assetFactoryWithNullValues().createPipe({}).roughness).toBeNull();
  });

  it("keeps the provided roughness value", () => {
    expect(
      assetFactoryWithNullValues().createPipe({ roughness: 95 }).roughness,
    ).toEqual(95);
  });
});
