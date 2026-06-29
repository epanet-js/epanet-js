import {
  emptyCustomAttributesData,
  getValue,
  setValue,
} from "@epanet-js/custom-attributes";
import { applyMomentToCustomAttributes } from "./apply-moment";

describe("applyMomentToCustomAttributes", () => {
  it("applies value changes and returns a reverse restoring the prior value", () => {
    const initial = setValue(emptyCustomAttributesData(), 7, "ca-1", "Alice");

    const { data, reverse } = applyMomentToCustomAttributes(initial, {
      putValues: [
        {
          assetId: 7,
          attributeId: "ca-1",
          value: "Bob",
        },
      ],
    });

    expect(getValue(data, 7, "ca-1")).toEqual("Bob");
    expect(getValue(initial, 7, "ca-1")).toEqual("Alice");

    const restored = applyMomentToCustomAttributes(data, reverse);
    expect(getValue(restored.data, 7, "ca-1")).toEqual("Alice");
  });

  it("captures null as the prior value when none was set", () => {
    const { reverse } = applyMomentToCustomAttributes(
      emptyCustomAttributesData(),
      {
        putValues: [{ assetId: 3, attributeId: "ca-2", value: 42 }],
      },
    );

    expect(reverse.putValues).toEqual([
      { assetId: 3, attributeId: "ca-2", value: null },
    ]);
  });
});
