import type { PipeMaterial } from "@epanet-js/pipe-library";
import { buildPipeLibraryData } from "./builders";
import { serializePipeLibrary } from "./to-rows";

describe("buildPipeLibraryData", () => {
  it("returns an empty array for null", () => {
    expect(buildPipeLibraryData(null)).toEqual([]);
  });

  it("builds the materials array from a JSON string", () => {
    const materials = [{ label: "PVC", entries: [{ age: 0, roughness: 150 }] }];

    expect(buildPipeLibraryData(JSON.stringify(materials))).toEqual(materials);
  });

  it("throws on invalid JSON", () => {
    expect(() => buildPipeLibraryData("{not json")).toThrow(
      /Pipe library: data is not valid JSON/,
    );
  });

  it("throws when data does not match the schema", () => {
    expect(() =>
      buildPipeLibraryData(JSON.stringify([{ label: 42, entries: [] }])),
    ).toThrow(/Pipe library: data does not match schema/);
  });

  it("round-trips with the serializer", () => {
    const materials: PipeMaterial[] = [
      { label: "Cast Iron", entries: [{ age: null, roughness: null }] },
      { label: "PVC", entries: [{ age: 0, roughness: 150 }] },
    ];

    expect(buildPipeLibraryData(serializePipeLibrary(materials))).toEqual(
      materials,
    );
  });
});
