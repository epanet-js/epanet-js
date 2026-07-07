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

describe("pump and valve length", () => {
  it("is always null (pumps and valves are zero-length links)", () => {
    expect(assetFactory().createPump({}).length).toBeNull();
    expect(assetFactory().createValve({}).length).toBeNull();
    expect(assetFactoryWithNullValues().createPump({}).length).toBeNull();
    expect(assetFactoryWithNullValues().createValve({}).length).toBeNull();
  });
});

describe("AssetFactoryWithNullValues tank dimensions", () => {
  it("leaves tank dimensions empty when unmapped", () => {
    const tank = assetFactoryWithNullValues().createTank({});

    expect(tank.initialLevel).toBeNull();
    expect(tank.minLevel).toBeNull();
    expect(tank.maxLevel).toBeNull();
    expect(tank.diameter).toBeNull();
  });

  it("keeps provided tank dimensions", () => {
    const tank = assetFactoryWithNullValues().createTank({
      initialLevel: 3,
      minLevel: 1,
      maxLevel: 8,
      diameter: 5,
    });

    expect(tank.initialLevel).toEqual(3);
    expect(tank.minLevel).toEqual(1);
    expect(tank.maxLevel).toEqual(8);
    expect(tank.diameter).toEqual(5);
  });
});

describe("AssetFactoryWithNullValues optional attributes", () => {
  it("leaves EPANET-optional attributes undefined when none is provided", () => {
    const factory = assetFactoryWithNullValues();

    expect(factory.createPipe({}).minorLoss).toBeUndefined();
    expect(factory.createValve({}).minorLoss).toBeUndefined();
    expect(factory.createJunction({}).emitterCoefficient).toBeUndefined();
    expect(factory.createJunction({}).initialQuality).toBeUndefined();
    expect(factory.createReservoir({}).initialQuality).toBeUndefined();
    expect(factory.createTank({}).minVolume).toBeUndefined();
    expect(factory.createTank({}).mixingFraction).toBeUndefined();
    expect(factory.createTank({}).initialQuality).toBeUndefined();
    expect(factory.createPump({}).speed).toBeUndefined();
  });

  it("keeps provided optional values", () => {
    const factory = assetFactoryWithNullValues();

    expect(factory.createPipe({ minorLoss: 3 }).minorLoss).toEqual(3);
    expect(
      factory.createJunction({ emitterCoefficient: 2 }).emitterCoefficient,
    ).toEqual(2);
    expect(factory.createTank({ mixingFraction: 0.5 }).mixingFraction).toEqual(
      0.5,
    );
    expect(factory.createPump({ speed: 2 }).speed).toEqual(2);
  });

  it("keeps an explicitly provided default value", () => {
    const factory = assetFactoryWithNullValues();

    expect(factory.createPipe({ minorLoss: 0 }).minorLoss).toEqual(0);
    expect(factory.createPump({ speed: 1 }).speed).toEqual(1);
  });
});

describe("AssetFactory optional attributes", () => {
  it("applies factory presets for EPANET-optional attributes", () => {
    const factory = assetFactory();

    expect(factory.createPipe({}).minorLoss).toEqual(0);
    expect(factory.createJunction({}).emitterCoefficient).toEqual(0);
    expect(factory.createTank({}).mixingFraction).toEqual(1);
    expect(factory.createPump({}).speed).toEqual(1);
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
