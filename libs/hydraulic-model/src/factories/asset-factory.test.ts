import { describe, it, expect } from "vitest";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";
import { AssetFactory } from "./asset-factory";
import { LabelManager } from "../label-manager";

const assetFactory = () =>
  new AssetFactory(new ConsecutiveIdsGenerator(), new LabelManager());

describe("AssetFactory createPipe roughness", () => {
  it("leaves roughness empty when none is provided", () => {
    expect(assetFactory().createPipe({}).roughness).toBeNull();
  });

  it("keeps the provided roughness value", () => {
    expect(assetFactory().createPipe({ roughness: 95 }).roughness).toEqual(95);
  });
});

describe("AssetFactory createPipe diameter", () => {
  it("leaves diameter empty when none is provided", () => {
    expect(assetFactory().createPipe({}).diameter).toBeNull();
  });

  it("keeps the provided diameter value", () => {
    expect(assetFactory().createPipe({ diameter: 150 }).diameter).toEqual(150);
  });
});

describe("AssetFactory createPipe length", () => {
  it("leaves length empty when none is provided", () => {
    expect(assetFactory().createPipe({}).length).toBeNull();
  });

  it("keeps the provided length value", () => {
    expect(assetFactory().createPipe({ length: 500 }).length).toEqual(500);
  });
});

describe("pump and valve length", () => {
  it("is always null (pumps and valves are zero-length links)", () => {
    expect(assetFactory().createPump({}).length).toBeNull();
    expect(assetFactory().createValve({}).length).toBeNull();
    expect(assetFactory().createPump({}).length).toBeNull();
    expect(assetFactory().createValve({}).length).toBeNull();
  });
});

describe("AssetFactory tank dimensions", () => {
  it("leaves tank dimensions empty when unmapped", () => {
    const tank = assetFactory().createTank({});

    expect(tank.initialLevel).toBeNull();
    expect(tank.minLevel).toBeNull();
    expect(tank.maxLevel).toBeNull();
    expect(tank.diameter).toBeNull();
  });

  it("keeps provided tank dimensions", () => {
    const tank = assetFactory().createTank({
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

describe("AssetFactory node elevation", () => {
  it("leaves elevation empty when unmapped", () => {
    const factory = assetFactory();

    expect(factory.createJunction({}).elevation).toBeNull();
    expect(factory.createReservoir({}).elevation).toBeNull();
    expect(factory.createTank({}).elevation).toBeNull();
  });

  it("keeps the provided elevation value", () => {
    const factory = assetFactory();

    expect(factory.createJunction({ elevation: 42 }).elevation).toEqual(42);
    expect(factory.createReservoir({ elevation: 42 }).elevation).toEqual(42);
    expect(factory.createTank({ elevation: 42 }).elevation).toEqual(42);
  });
});

describe("AssetFactory createPump curve", () => {
  it("leaves a curve-based pump's curve empty when unmapped", () => {
    expect(
      assetFactory().createPump({
        definitionType: "designPointCurve",
      }).curve,
    ).toBeNull();
  });

  it("keeps the provided curve", () => {
    expect(
      assetFactory().createPump({
        definitionType: "designPointCurve",
        curve: [{ x: 5, y: 10 }],
      }).curve,
    ).toEqual([{ x: 5, y: 10 }]);
  });
});

describe("AssetFactory createPump power", () => {
  it("leaves power empty when none is provided", () => {
    expect(assetFactory().createPump({}).power).toBeNull();
  });

  it("keeps the provided power value", () => {
    expect(assetFactory().createPump({ power: 25 }).power).toEqual(25);
  });
});

describe("AssetFactory optional attributes", () => {
  it("leaves EPANET-optional attributes undefined when none is provided", () => {
    const factory = assetFactory();

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
    const factory = assetFactory();

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
    const factory = assetFactory();

    expect(factory.createPipe({ minorLoss: 0 }).minorLoss).toEqual(0);
    expect(factory.createPump({ speed: 1 }).speed).toEqual(1);
  });
});

describe("AssetFactory createReservoir head", () => {
  it("leaves head empty when neither head nor relativeHead is provided", () => {
    expect(assetFactory().createReservoir({}).head).toBeNull();
  });

  it("keeps the provided head value", () => {
    expect(assetFactory().createReservoir({ head: 42 }).head).toEqual(42);
  });

  it("derives head from elevation + relativeHead instead of nulling it", () => {
    const reservoir = assetFactory().createReservoir({
      elevation: 100,
      relativeHead: 10,
    });
    expect(reservoir.head).toEqual(110);
  });
});

describe("createPipe customAttributes", () => {
  it("sets each non-null custom attribute as a property", () => {
    const pipe = assetFactory().createPipe({
      customAttributes: { "custom-1": 100, "custom-2": "PVC" },
    });

    expect(pipe.getProperty("custom-1")).toEqual(100);
    expect(pipe.getProperty("custom-2")).toEqual("PVC");
  });

  it("skips null custom attribute values", () => {
    const pipe = assetFactory().createPipe({
      customAttributes: { "custom-1": null },
    });

    expect(pipe.hasProperty("custom-1")).toBe(false);
  });

  it("applies custom attributes on the null-values factory too", () => {
    const pipe = assetFactory().createPipe({
      customAttributes: { "custom-1": 250 },
    });

    expect(pipe.getProperty("custom-1")).toEqual(250);
  });
});

describe("custom attributes on other asset types", () => {
  it("sets custom attributes on a junction", () => {
    const junction = assetFactory().createJunction({
      customAttributes: { "custom-3": "zone-A" },
    });

    expect(junction.getProperty("custom-3")).toEqual("zone-A");
  });

  it("sets custom attributes on a reservoir, tank and valve", () => {
    const factory = assetFactory();

    expect(
      factory
        .createReservoir({ customAttributes: { "custom-1": 1 } })
        .getProperty("custom-1"),
    ).toEqual(1);
    expect(
      factory
        .createTank({ customAttributes: { "custom-2": 2 } })
        .getProperty("custom-2"),
    ).toEqual(2);
    expect(
      factory
        .createValve({ customAttributes: { "custom-3": 3 } })
        .getProperty("custom-3"),
    ).toEqual(3);
  });

  it("applies custom attributes on the null-values pump (no super delegation)", () => {
    const pump = assetFactory().createPump({
      customAttributes: { "custom-4": "diesel" },
    });

    expect(pump.getProperty("custom-4")).toEqual("diesel");
  });
});
