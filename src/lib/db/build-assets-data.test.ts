import { presets } from "src/lib/project-settings/quantities-spec";
import { ConsecutiveIdsGenerator } from "src/lib/id-generator";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { initializeModelFactories } from "src/hydraulic-model/factories";
import type { Pipe } from "src/hydraulic-model/asset-types/pipe";
import type { Pump } from "src/hydraulic-model/asset-types/pump";
import type { Junction } from "src/hydraulic-model/asset-types/junction";
import { buildAssetsData } from "./build-assets-data";
import {
  findMaxId,
  type AssetRows,
  type JunctionRow,
  type PipeRow,
  type PumpRow,
} from "./rows";

const emptyRows = (): AssetRows => ({
  junctions: [],
  reservoirs: [],
  tanks: [],
  pipes: [],
  pumps: [],
  valves: [],
});

const makeFactories = (maxId = 0) =>
  initializeModelFactories({
    idGenerator: new ConsecutiveIdsGenerator(maxId),
    labelManager: new LabelManager(),
    defaults: presets.LPS.defaults,
  });

const makeJunction = (overrides: Partial<JunctionRow>): JunctionRow => ({
  id: 0,
  type: "junction",
  label: null,
  is_active: 1,
  coord_x: 0,
  coord_y: 0,
  elevation: null,
  initial_quality: null,
  chemical_source_type: null,
  chemical_source_strength: null,
  chemical_source_pattern_id: null,
  emitter_coefficient: null,
  ...overrides,
});

const makePipe = (overrides: Partial<PipeRow>): PipeRow => ({
  id: 0,
  type: "pipe",
  label: null,
  is_active: 1,
  start_node_id: 0,
  end_node_id: 0,
  coords: "[[0,0],[1,1]]",
  length: null,
  initial_status: null,
  diameter: null,
  roughness: null,
  minor_loss: null,
  bulk_reaction_coeff: null,
  wall_reaction_coeff: null,
  ...overrides,
});

const makePump = (overrides: Partial<PumpRow>): PumpRow => ({
  id: 0,
  type: "pump",
  label: null,
  is_active: 1,
  start_node_id: 0,
  end_node_id: 0,
  coords: "[[0,0],[1,1]]",
  length: null,
  initial_status: null,
  definition_type: "power",
  power: null,
  speed: null,
  speed_pattern_id: null,
  efficiency_curve_id: null,
  energy_price: null,
  energy_price_pattern_id: null,
  curve_id: null,
  ...overrides,
});

describe("findMaxId", () => {
  it("returns 0 when no rows are provided", () => {
    expect(findMaxId(emptyRows())).toBe(0);
  });

  it("scans all asset collections", () => {
    const rows = emptyRows();
    rows.junctions = [makeJunction({ id: 5 })];
    rows.pipes = [makePipe({ id: 42, start_node_id: 5, end_node_id: 5 })];
    expect(findMaxId(rows)).toBe(42);
  });
});

describe("buildAssetsData", () => {
  it("returns empty collections when no rows are provided", () => {
    const { assets, topology } = buildAssetsData(emptyRows(), makeFactories());

    expect(assets.size).toBe(0);
    expect(topology.getLinks(1)).toEqual([]);
  });

  it("rebuilds junctions preserving id, label, and coordinates", () => {
    const rows = emptyRows();
    rows.junctions = [
      makeJunction({
        id: 7,
        label: "J7",
        coord_x: 10,
        coord_y: 20,
        elevation: 100,
      }),
    ];

    const { assets } = buildAssetsData(rows, makeFactories(7));
    const junction = assets.get(7) as Junction;

    expect(junction).toBeDefined();
    expect(junction.label).toBe("J7");
    expect(junction.coordinates).toEqual([10, 20]);
    expect(junction.elevation).toBe(100);
  });

  it("populates topology from link rows", () => {
    const rows = emptyRows();
    rows.junctions = [
      makeJunction({ id: 1, label: "J1" }),
      makeJunction({ id: 2, label: "J2", coord_x: 1, coord_y: 0 }),
    ];
    rows.pipes = [
      makePipe({
        id: 3,
        label: "P1",
        start_node_id: 1,
        end_node_id: 2,
        coords: "[[0,0],[1,0]]",
      }),
    ];

    const { assets, topology } = buildAssetsData(rows, makeFactories(3));
    const pipe = assets.get(3) as Pipe;

    expect(pipe.connections).toEqual([1, 2]);
    expect(topology.getLinks(1)).toContain(3);
    expect(topology.getLinks(2)).toContain(3);
  });

  it("registers labels so duplicates are avoided for new assets", () => {
    const rows = emptyRows();
    rows.junctions = [makeJunction({ id: 1, label: "J1" })];

    const factories = makeFactories(1);
    buildAssetsData(rows, factories);
    const fresh = factories.assetFactory.createJunction();

    expect(fresh.label).not.toBe("J1");
  });

  it("rebuilds pump from the stored definition_type column", () => {
    const rows = emptyRows();
    rows.junctions = [
      makeJunction({ id: 1, label: "J1" }),
      makeJunction({ id: 2, label: "J2", coord_x: 1 }),
    ];
    rows.pumps = [
      makePump({
        id: 10,
        label: "PU1",
        start_node_id: 1,
        end_node_id: 2,
        definition_type: "curveId",
        curve_id: "99",
      }),
    ];

    const { assets } = buildAssetsData(rows, makeFactories(10));
    const pump = assets.get(10) as Pump;

    expect(pump.definitionType).toBe("curveId");
    expect(pump.curveId).toBe(99);
  });

  it("populates the asset index with nodes and links", () => {
    const rows = emptyRows();
    rows.junctions = [
      makeJunction({ id: 1, label: "J1" }),
      makeJunction({ id: 2, label: "J2", coord_x: 1 }),
    ];
    rows.pipes = [
      makePipe({ id: 3, label: "P1", start_node_id: 1, end_node_id: 2 }),
    ];

    const { assetIndex } = buildAssetsData(rows, makeFactories(3));

    expect(assetIndex.nodeCount).toBe(2);
    expect(assetIndex.linkCount).toBe(1);
  });
});
