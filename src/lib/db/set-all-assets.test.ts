import { presets } from "src/lib/project-settings/quantities-spec";
import { ConsecutiveIdsGenerator } from "src/lib/id-generator";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { initializeModelFactories } from "src/hydraulic-model/factories";
import { AssetsMap } from "src/hydraulic-model/assets-map";
import type { Junction } from "src/hydraulic-model/asset-types/junction";
import type { Pipe } from "src/hydraulic-model/asset-types/pipe";
import type { Pump } from "src/hydraulic-model/asset-types/pump";
import { assetsToRows } from "./set-all-assets";
import { buildAssetsData } from "./build-assets-data";

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
      type: "junction",
      label: "J1",
      coord_x: 10,
      coord_y: 20,
      elevation: 5,
      is_active: 1,
    });
    expect(rows.pipes[0]).toMatchObject({
      id: 4,
      type: "pipe",
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

  it("writes the pump definition_type column for each definition variant", () => {
    const factories = makeFactories();
    const { assetFactory } = factories;
    const assets: AssetsMap = new Map();

    const powerPump = assetFactory.createPump({
      id: 1,
      label: "PU1",
      definitionType: "power",
      power: 75,
    });
    assets.set(powerPump.id, powerPump);

    const curveIdPump = assetFactory.createPump({
      id: 2,
      label: "PU2",
      definitionType: "curveId",
      curveId: 99,
    });
    assets.set(curveIdPump.id, curveIdPump);

    const curvePump = assetFactory.createPump({
      id: 3,
      label: "PU3",
      definitionType: "curve",
    });
    assets.set(curvePump.id, curvePump);

    const rows = assetsToRows(assets.values());

    expect(rows.pumps[0]).toMatchObject({
      id: 1,
      definition_type: "power",
      power: 75,
    });
    expect(rows.pumps[1]).toMatchObject({
      id: 2,
      definition_type: "curveId",
      curve_id: 99,
    });
    expect(rows.pumps[2]).toMatchObject({
      id: 3,
      definition_type: "curve",
    });
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
  it("preserves pump definitionType across the three variants", () => {
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
        definitionType: "curve",
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
    expect((rebuilt.get(5) as Pump).definitionType).toBe("curve");
    expect((rebuilt.get(5) as Pump).curve).toEqual([
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
        definitionType: "curve",
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
