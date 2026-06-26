import { describe, expect, it } from "vitest";
import { serializePipeLibrary } from "./to-rows";

describe("serializePipeLibrary", () => {
  it("produces a JSON string that round-trips through JSON.parse", () => {
    const materials = [{ label: "PVC", entries: [{ age: 0, roughness: 150 }] }];
    const data = serializePipeLibrary(materials);
    expect(JSON.parse(data)).toEqual(materials);
  });

  it("accepts an empty array", () => {
    const data = serializePipeLibrary([]);
    expect(JSON.parse(data)).toEqual([]);
  });

  it("accepts entries with null age and roughness", () => {
    const materials = [
      { label: "Cast Iron", entries: [{ age: null, roughness: null }] },
    ];
    const data = serializePipeLibrary(materials);
    expect(JSON.parse(data)).toEqual(materials);
  });

  it("throws when an entry has an invalid shape", () => {
    expect(() =>
      serializePipeLibrary([{ label: 42 as never, entries: [] }]),
    ).toThrow(/Pipe library: data does not match schema/);
  });
});
