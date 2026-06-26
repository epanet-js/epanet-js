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

describe("AssetFactoryWithNullValues createReservoir head", () => {
  it("leaves head empty when neither head nor relativeHead is provided", () => {
    expect(assetFactoryWithNullValues().createReservoir({}).head).toBeNull();
  });

  it("keeps the provided head value", () => {
    expect(
      assetFactoryWithNullValues().createReservoir({ head: 42 }).head,
    ).toEqual(42);
  });

  it("derives head from elevation + relativeHead instead of nulling it", () => {
    const reservoir = assetFactoryWithNullValues().createReservoir({
      elevation: 100,
      relativeHead: 10,
    });
    expect(reservoir.head).toEqual(110);
  });
});
