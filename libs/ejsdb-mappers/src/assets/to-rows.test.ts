import { presets } from "@epanet-js/project-settings";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";
import {
  LabelManager,
  initializeModelFactories,
  type Junction,
  type Pipe,
  type Pump,
  type Reservoir,
  type Tank,
  type Valve,
} from "@epanet-js/hydraulic-model";
import { AssetsMap } from "@epanet-js/hydraulic-model";
import { assetsToRows } from "./to-rows";
import { buildAssetsData } from "./builders";

const makeFactories = () =>
  initializeModelFactories({
    idGenerator: new ConsecutiveIdsGenerator(),
    labelManager: new LabelManager(),
    defaults: presets.LPS.defaults,
  });

describe("assetsToRows", () => {
  it("returns empty collections for an empty map", () => {
    const rows = assetsToRows(new Map<number, never>().values());

    expect(rows.junctions).toEqual([]);
    expect(rows.reservoirs).toEqual([]);
    expect(rows.tanks).toEqual([]);
    expect(rows.pipes).toEqual([]);
    expect(rows.pumps).toEqual([]);
    expect(rows.valves).toEqual([]);
  });

  it("maps each asset type into the matching row bucket", () => {
    const factories = makeFactories();
    const { assetFactory } = factories;
    const assets: AssetsMap = new Map();

    const junction = assetFactory.createJunction({
      id: 1,
      label: "J1",
      coordinates: [10, 20],
      elevation: 5,
      emitterCoefficient: 0,
    });
    assets.set(junction.id, junction);

    const reservoir = assetFactory.createReservoir({
      id: 2,
      label: "R1",
      coordinates: [11, 21],
      head: 100,
    });
    assets.set(reservoir.id, reservoir);

    const tank = assetFactory.createTank({
      id: 3,
      label: "T1",
      coordinates: [12, 22],
    });
    assets.set(tank.id, tank);

    const pipe = assetFactory.createPipe({
      id: 4,
      label: "P1",
      coordinates: [
        [10, 20],
        [11, 21],
      ],
      connections: [1, 2],
    });
    assets.set(pipe.id, pipe);

    const pump = assetFactory.createPump({
      id: 5,
      label: "PU1",
      coordinates: [
        [10, 20],
        [12, 22],
      ],
      connections: [1, 3],
      definitionType: "power",
      power: 50,
    });
    assets.set(pump.id, pump);

    const valve = assetFactory.createValve({
      id: 6,
      label: "V1",
      coordinates: [
        [11, 21],
        [12, 22],
      ],
      connections: [2, 3],
      kind: "prv",
    });
    assets.set(valve.id, valve);

    const rows = assetsToRows(assets.values());

    expect(rows.junctions).toHaveLength(1);
    expect(rows.reservoirs).toHaveLength(1);
    expect(rows.tanks).toHaveLength(1);
    expect(rows.pipes).toHaveLength(1);
    expect(rows.pumps).toHaveLength(1);
    expect(rows.valves).toHaveLength(1);

    expect(rows.junctions[0]).toMatchObject({
      id: 1,
      label: "J1",
      coord_x: 10,
      coord_y: 20,
      elevation: 5,
      is_active: 1,
    });
    expect(rows.pipes[0]).toMatchObject({
      id: 4,
      start_node_id: 1,
      end_node_id: 2,
      is_active: 1,
    });
    expect(JSON.parse(rows.pipes[0].coords)).toEqual([
      [10, 20],
      [11, 21],
    ]);
    expect(rows.pumps[0]).toMatchObject({
      id: 5,
      definition_type: "power",
      power: 50,
      curve_id: null,
    });
    expect(rows.valves[0]).toMatchObject({
      id: 6,
      valve_kind: "prv",
    });
  });

  it("serializes unset EPANET-optional attributes as null", () => {
    const { assetFactory } = makeFactories();
    const assets: AssetsMap = new Map();

    const junction = assetFactory.createJunction({ id: 1, label: "J1" });
    const tank = assetFactory.createTank({ id: 2, label: "T1" });
    const pipe = assetFactory.createPipe({
      id: 3,
      label: "P1",
      connections: [1, 2],
    });
    const pump = assetFactory.createPump({
      id: 4,
      label: "PU1",
      connections: [1, 2],
      definitionType: "power",
    });
    const valve = assetFactory.createValve({
      id: 5,
      label: "V1",
      connections: [1, 2],
    });
    for (const asset of [junction, tank, pipe, pump, valve]) {
      assets.set(asset.id, asset);
    }

    const rows = assetsToRows(assets.values());

    expect(rows.junctions[0].initial_quality).toBeNull();
    expect(rows.junctions[0].emitter_coefficient).toBeNull();
    expect(rows.tanks[0].initial_quality).toBeNull();
    expect(rows.tanks[0].min_volume).toBeNull();
    expect(rows.tanks[0].mixing_fraction).toBeNull();
    expect(rows.pipes[0].minor_loss).toBeNull();
    expect(rows.pumps[0].speed).toBeNull();
    expect(rows.pumps[0].power).toBeNull();
    expect(rows.valves[0].minor_loss).toBeNull();
  });

  it("round-trips unset EPANET-optional attributes back to undefined", () => {
    const { assetFactory } = makeFactories();
    const original: AssetsMap = new Map();
    const junction = assetFactory.createJunction({ id: 1, label: "J1" });
    const tank = assetFactory.createTank({ id: 2, label: "T1" });
    const valve = assetFactory.createValve({
      id: 3,
      label: "V1",
      connections: [1, 2],
    });
    const pump = assetFactory.createPump({
      id: 4,
      label: "PU1",
      connections: [1, 2],
      definitionType: "power",
    });
    for (const asset of [junction, tank, valve, pump]) {
      original.set(asset.id, asset);
    }

    const { assets: rebuilt } = buildAssetsData(
      assetsToRows(original.values()),
      makeFactories(),
    );

    expect((rebuilt.get(1) as Junction).emitterCoefficient).toBeUndefined();
    expect((rebuilt.get(1) as Junction).initialQuality).toBeUndefined();
    expect((rebuilt.get(2) as Tank).minVolume).toBeUndefined();
    expect((rebuilt.get(2) as Tank).mixingFraction).toBeUndefined();
    expect((rebuilt.get(3) as Valve).minorLoss).toBeUndefined();
    // Power is nullable (required-for-definition), so it round-trips to null.
    expect((rebuilt.get(4) as Pump).power).toBeNull();
  });

  it("round-trips unmapped nullable attributes back to null", () => {
    const { assetFactory } = makeFactories();
    const original: AssetsMap = new Map();
    const pipe = assetFactory.createPipe({
      id: 1,
      label: "P1",
      connections: [10, 11],
    });
    const reservoir = assetFactory.createReservoir({ id: 2, label: "R1" });
    const tank = assetFactory.createTank({ id: 3, label: "T1" });
    const valve = assetFactory.createValve({
      id: 4,
      label: "V1",
      connections: [10, 11],
    });
    const junction = assetFactory.createJunction({ id: 5, label: "J1" });
    for (const asset of [pipe, reservoir, tank, valve, junction]) {
      original.set(asset.id, asset);
    }

    const { assets: rebuilt } = buildAssetsData(
      assetsToRows(original.values()),
      makeFactories(),
    );

    const rebuiltPipe = rebuilt.get(1) as Pipe;
    expect(rebuiltPipe.length).toBeNull();
    expect(rebuiltPipe.diameter).toBeNull();
    expect(rebuiltPipe.roughness).toBeNull();
    const rebuiltReservoir = rebuilt.get(2) as Reservoir;
    expect(rebuiltReservoir.head).toBeNull();
    expect(rebuiltReservoir.elevation).toBeNull();
    const rebuiltTank = rebuilt.get(3) as Tank;
    expect(rebuiltTank.initialLevel).toBeNull();
    expect(rebuiltTank.minLevel).toBeNull();
    expect(rebuiltTank.maxLevel).toBeNull();
    expect(rebuiltTank.diameter).toBeNull();
    expect(rebuiltTank.elevation).toBeNull();
    const rebuiltValve = rebuilt.get(4) as Valve;
    expect(rebuiltValve.diameter).toBeNull();
    expect(rebuiltValve.setting).toBeNull();
    expect((rebuilt.get(5) as Junction).elevation).toBeNull();
  });

  it("serializes isActive=false as 0", () => {
    const factories = makeFactories();
    const junction = factories.assetFactory.createJunction({
      id: 1,
      label: "J1",
      isActive: false,
    });
    const assets: AssetsMap = new Map([[junction.id, junction]]);

    const rows = assetsToRows(assets.values());

    expect(rows.junctions[0].is_active).toBe(0);
  });
});

describe("assetsToRows + buildAssetsData round-trip", () => {
  it("preserves pump definitionType across all four variants", () => {
    const factories = makeFactories();
    const { assetFactory } = factories;
    const original: AssetsMap = new Map();

    original.set(
      1,
      assetFactory.createJunction({ id: 1, label: "J1", coordinates: [0, 0] }),
    );
    original.set(
      2,
      assetFactory.createJunction({ id: 2, label: "J2", coordinates: [1, 0] }),
    );
    original.set(
      3,
      assetFactory.createPump({
        id: 3,
        label: "PU1",
        connections: [1, 2],
        definitionType: "power",
        power: 60,
      }),
    );
    original.set(
      4,
      assetFactory.createPump({
        id: 4,
        label: "PU2",
        connections: [1, 2],
        definitionType: "curveId",
        curveId: 7,
      }),
    );
    original.set(
      5,
      assetFactory.createPump({
        id: 5,
        label: "PU3",
        connections: [1, 2],
        definitionType: "designPointCurve",
        curve: [{ x: 100, y: 10 }],
      }),
    );
    original.set(
      6,
      assetFactory.createPump({
        id: 6,
        label: "PU4",
        connections: [1, 2],
        definitionType: "standardCurve",
        curve: [
          { x: 0, y: 100 },
          { x: 50, y: 80 },
          { x: 100, y: 0 },
        ],
      }),
    );

    const { assets: rebuilt } = buildAssetsData(
      assetsToRows(original.values()),
      makeFactories(),
    );

    expect((rebuilt.get(3) as Pump).definitionType).toBe("power");
    expect((rebuilt.get(4) as Pump).definitionType).toBe("curveId");
    expect((rebuilt.get(4) as Pump).curveId).toBe(7);
    expect((rebuilt.get(5) as Pump).definitionType).toBe("designPointCurve");
    expect((rebuilt.get(5) as Pump).curve).toEqual([{ x: 100, y: 10 }]);
    expect((rebuilt.get(6) as Pump).definitionType).toBe("standardCurve");
    expect((rebuilt.get(6) as Pump).curve).toEqual([
      { x: 0, y: 100 },
      { x: 50, y: 80 },
      { x: 100, y: 0 },
    ]);
  });

  it("leaves curve_points null for non-inline pumps", () => {
    const factories = makeFactories();
    const { assetFactory } = factories;
    const original: AssetsMap = new Map();
    original.set(
      1,
      assetFactory.createJunction({ id: 1, label: "J1", coordinates: [0, 0] }),
    );
    original.set(
      2,
      assetFactory.createJunction({ id: 2, label: "J2", coordinates: [1, 0] }),
    );
    original.set(
      3,
      assetFactory.createPump({
        id: 3,
        label: "PU_POWER",
        connections: [1, 2],
        definitionType: "power",
        power: 60,
      }),
    );
    original.set(
      4,
      assetFactory.createPump({
        id: 4,
        label: "PU_BYID",
        connections: [1, 2],
        definitionType: "curveId",
        curveId: 7,
      }),
    );

    const rows = assetsToRows(original.values());

    expect(rows.pumps[0].curve_points).toBeNull();
    expect(rows.pumps[1].curve_points).toBeNull();
  });

  it("throws when inline curve points contain NaN or Infinity", () => {
    const factories = makeFactories();
    const { assetFactory } = factories;
    const original: AssetsMap = new Map();
    original.set(
      1,
      assetFactory.createJunction({ id: 1, label: "J1", coordinates: [0, 0] }),
    );
    original.set(
      2,
      assetFactory.createJunction({ id: 2, label: "J2", coordinates: [1, 0] }),
    );
    original.set(
      3,
      assetFactory.createPump({
        id: 3,
        label: "BadPump",
        connections: [1, 2],
        definitionType: "designPointCurve",
        curve: [{ x: 0, y: NaN }],
      }),
    );

    expect(() => assetsToRows(original.values())).toThrow(
      /Pump 3 \(BadPump\): inline curve points must be an array of \{x,y\} with finite numbers/,
    );
  });

  it("rehydrates to a model with the same assets and topology", () => {
    const factories = makeFactories();
    const { assetFactory } = factories;
    const original: AssetsMap = new Map();

    const j1 = assetFactory.createJunction({
      id: 1,
      label: "J1",
      coordinates: [0, 0],
      elevation: 100,
    });
    const j2 = assetFactory.createJunction({
      id: 2,
      label: "J2",
      coordinates: [1, 0],
      elevation: 90,
    });
    const p1 = assetFactory.createPipe({
      id: 3,
      label: "P1",
      coordinates: [
        [0, 0],
        [1, 0],
      ],
      connections: [1, 2],
      diameter: 200,
      length: 500,
    });
    original.set(j1.id, j1);
    original.set(j2.id, j2);
    original.set(p1.id, p1);

    const rebuildFactories = makeFactories();
    const { assets: rebuilt, topology } = buildAssetsData(
      assetsToRows(original.values()),
      rebuildFactories,
    );

    expect(rebuilt.size).toBe(3);
    const rebuiltJunction = rebuilt.get(1) as Junction;
    expect(rebuiltJunction.label).toBe("J1");
    expect(rebuiltJunction.coordinates).toEqual([0, 0]);
    expect(rebuiltJunction.elevation).toBe(100);

    const rebuiltPipe = rebuilt.get(3) as Pipe;
    expect(rebuiltPipe.label).toBe("P1");
    expect(rebuiltPipe.connections).toEqual([1, 2]);
    expect(rebuiltPipe.diameter).toBe(200);
    expect(rebuiltPipe.length).toBe(500);

    expect(topology.getLinks(1)).toContain(3);
    expect(topology.getLinks(2)).toContain(3);
  });
});
