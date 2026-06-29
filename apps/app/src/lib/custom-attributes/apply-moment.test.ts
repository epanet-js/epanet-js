import {
  emptyCustomAttributesData,
  getValue,
  setValue,
} from "@epanet-js/custom-attributes";
import { applyMomentToCustomAttributes } from "./apply-moment";

describe("applyMomentToCustomAttributes", () => {
  it("applies value changes and returns a reverse restoring the prior value", () => {
    const initial = setValue(
      emptyCustomAttributesData(),
      "junction",
      7,
      "ca-1",
      "Alice",
    );

    const { data, reverse } = applyMomentToCustomAttributes(initial, {
      putValues: [
        {
          assetType: "junction",
          assetId: 7,
          attributeId: "ca-1",
          value: "Bob",
        },
      ],
    });

    expect(getValue(data, "junction", 7, "ca-1")).toEqual("Bob");
    expect(getValue(initial, "junction", 7, "ca-1")).toEqual("Alice");

    const restored = applyMomentToCustomAttributes(data, reverse);
    expect(getValue(restored.data, "junction", 7, "ca-1")).toEqual("Alice");
  });

  it("captures null as the prior value when none was set", () => {
    const { reverse } = applyMomentToCustomAttributes(
      emptyCustomAttributesData(),
      {
        putValues: [
          { assetType: "pipe", assetId: 3, attributeId: "ca-2", value: 42 },
        ],
      },
    );

    expect(reverse.putValues).toEqual([
      { assetType: "pipe", assetId: 3, attributeId: "ca-2", value: null },
    ]);
  });
});
