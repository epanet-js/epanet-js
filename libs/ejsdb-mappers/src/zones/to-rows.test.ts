import { describe, it, expect } from "vitest";
import {
  LabelManager,
  initializeModelFactories,
  Zone,
  type Zones,
} from "@epanet-js/hydraulic-model";
import { buildTestIdPools } from "../__helpers__/id-pools";
import { zonesToRows } from "./to-rows";
import { buildZonesData } from "./builders";

const makeFactories = () =>
  initializeModelFactories({
    idPools: buildTestIdPools({}),
    labelManager: new LabelManager(),
  });

const aSquare: Zone["geometry"] = {
  type: "MultiPolygon",
  coordinates: [
    [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ],
    ],
  ],
};

const aZone = ({
  label = "Z1",
  geometry = aSquare,
}: { label?: string; geometry?: Zone["geometry"] } = {}) =>
  new Zone(1, geometry, [0, 0, 1, 1], { label });

const validZones = (): Zones => new Map([[1, aZone()]]);

describe("zonesToRows", () => {
  it("produces rows that round-trip through buildZonesData", () => {
    const zones = validZones();

    const rows = zonesToRows(zones);

    expect(buildZonesData(rows, makeFactories())).toEqual(zones);
  });

  it("round-trips custom attribute values", () => {
    const zones = validZones();
    zones.get(1)!.setProperty("custom-1", "NORTH");
    zones.get(1)!.setProperty("custom-2", 5);

    const rows = zonesToRows(zones);

    expect(rows[0].custom_attributes).toBe(
      JSON.stringify({ "custom-1": "NORTH", "custom-2": 5 }),
    );
    expect(buildZonesData(rows, makeFactories())).toEqual(zones);
  });

  it("writes no custom attributes for a zone without values", () => {
    expect(zonesToRows(validZones())[0].custom_attributes).toBeNull();
  });

  it("throws when a row does not match the schema", () => {
    const zones: Zones = new Map([
      [1, aZone({ label: 42 as unknown as string })],
    ]);

    expect(() => zonesToRows(zones)).toThrow(
      /Zone 1 \(42\): row does not match schema/,
    );
  });

  it("throws when a coordinate is not a finite number", () => {
    const zones: Zones = new Map([
      [
        1,
        aZone({
          geometry: { type: "MultiPolygon", coordinates: [[[[0, NaN]]]] },
        }),
      ],
    ]);

    expect(() => zonesToRows(zones)).toThrow(
      /Zone 1 \(Z1\): geometry must be a MultiPolygon of finite-number positions/,
    );
  });
});

describe("buildZonesData", () => {
  const aRow = (overrides: Record<string, unknown>) => ({
    ...zonesToRows(validZones())[0],
    ...overrides,
  });

  it("registers loaded labels so new zones avoid collisions", () => {
    const factories = makeFactories();
    buildZonesData([aRow({})], factories);

    expect(factories.labelManager.isLabelAvailable("Z1", "zone")).toBe(false);
    expect(
      factories.zoneFactory.create(validZones().get(1)!.geometry).label,
    ).not.toBe("Z1");
  });

  it("throws when the geometry is not valid JSON", () => {
    expect(() =>
      buildZonesData([aRow({ geometry: "{" })], makeFactories()),
    ).toThrow(/Zone 1 \(Z1\): geometry is not valid JSON/);
  });

  it("throws when the geometry is not a MultiPolygon", () => {
    const geometry = JSON.stringify({ type: "Point", coordinates: [0, 0] });

    expect(() => buildZonesData([aRow({ geometry })], makeFactories())).toThrow(
      /Zone 1 \(Z1\): geometry must be a MultiPolygon of finite-number positions/,
    );
  });

  it("throws when the bbox is not an array of numbers", () => {
    expect(() =>
      buildZonesData(
        [aRow({ bbox: JSON.stringify([0, 0, "1", 1]) })],
        makeFactories(),
      ),
    ).toThrow(/Zone 1 \(Z1\): bbox must be an array of finite numbers/);
  });
});
