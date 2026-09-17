import type { IdPoolSeeds } from "@epanet-js/id-generator";
import { buildIdPoolsData } from "./builders";
import { serializeIdPools } from "./to-rows";

describe("id pools mapping", () => {
  const seeds: IdPoolSeeds = {
    asset: 12,
    customerPoint: 4,
    pattern: 2,
    curve: 0,
    zone: 7,
  };

  it("returns null when nothing is stored", () => {
    expect(buildIdPoolsData(null)).toBeNull();
  });

  it("round-trips with the serializer", () => {
    expect(buildIdPoolsData(serializeIdPools(seeds))).toEqual(seeds);
  });

  it("throws on invalid JSON", () => {
    expect(() => buildIdPoolsData("{not json")).toThrow(
      /Id pools: data is not valid JSON/,
    );
  });

  it("throws when a pool is missing", () => {
    const withoutZone = { ...seeds, zone: undefined };

    expect(() => buildIdPoolsData(JSON.stringify(withoutZone))).toThrow(
      /Id pools: data does not match schema/,
    );
  });

  it("rejects a negative value on serialize", () => {
    expect(() => serializeIdPools({ ...seeds, curve: -1 })).toThrow(
      /Id pools: data does not match schema/,
    );
  });
});
