import {
  type CustomAttributesData,
  setValue,
  emptyCustomAttributesData,
} from "@epanet-js/custom-attributes";
import {
  customAttributesDataToRows,
  serializeCustomAttributesData,
} from "./to-rows";
import { buildCustomAttributesData } from "./builders";

const dataOf = (
  entries: Array<[number, Array<[string, string | number | null]>]>,
): CustomAttributesData => {
  let data = emptyCustomAttributesData();
  for (const [assetId, values] of entries) {
    for (const [attributeId, value] of values) {
      data = setValue(data, assetId, attributeId, value);
    }
  }
  return data;
};

describe("customAttributesDataToRows", () => {
  it("builds one JSON-blob row per asset with non-empty values", () => {
    const data = dataOf([
      [1, [["ca-1", "PVC"]]],
      [
        2,
        [
          ["ca-1", 42],
          ["ca-2", null],
        ],
      ],
    ]);

    const rows = customAttributesDataToRows(data);

    expect(rows).toEqual([
      { asset_id: 1, data: JSON.stringify({ "ca-1": "PVC" }) },
      { asset_id: 2, data: JSON.stringify({ "ca-1": 42, "ca-2": null }) },
    ]);
  });

  it("restricts output to the given asset ids and skips assets without values", () => {
    const data = dataOf([
      [1, [["ca-1", "PVC"]]],
      [2, [["ca-1", "DI"]]],
    ]);

    const rows = customAttributesDataToRows(data, [2, 3]);

    expect(rows).toEqual([
      { asset_id: 2, data: JSON.stringify({ "ca-1": "DI" }) },
    ]);
  });
});

describe("custom attributes data round-trip", () => {
  it("rebuilds the same data from serialized rows", () => {
    const data = dataOf([
      [1, [["ca-1", "PVC"]]],
      [
        2,
        [
          ["ca-1", 42],
          ["ca-2", null],
        ],
      ],
    ]);

    expect(
      buildCustomAttributesData(serializeCustomAttributesData(data)),
    ).toEqual(data);
  });

  it("throws when a row does not match the schema", () => {
    expect(() =>
      buildCustomAttributesData([{ asset_id: "x", data: "{}" }]),
    ).toThrow(/Custom attributes data: row data does not match schema/);
  });
});
