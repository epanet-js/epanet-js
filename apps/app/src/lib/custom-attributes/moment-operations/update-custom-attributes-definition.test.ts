import { describe, it, expect } from "vitest";
import {
  emptyCustomAttributesDefinition,
  setAttributes,
  setAssetValues,
  type CustomAttributesData,
} from "@epanet-js/custom-attributes";
import { updateCustomAttributesDefinition } from "./update-custom-attributes-definition";

const withAge = setAttributes(emptyCustomAttributesDefinition(), "junction", [
  { id: "ca-1", label: "Age", type: "number" },
]);

describe("updateCustomAttributesDefinition", () => {
  it("emits no value rows when nothing was removed", () => {
    const next = setAttributes(withAge, "junction", [
      { id: "ca-1", label: "Age", type: "number" },
      { id: "ca-2", label: "Name", type: "text" },
    ]);

    const moment = updateCustomAttributesDefinition(
      { definition: withAge, data: new Map() },
      next,
    );

    expect(moment.customAttributes?.putDefinition).toBe(next);
    expect(moment.customAttributes?.putValues).toEqual([]);
  });

  it("strips removed attributes only from affected assets", () => {
    let data: CustomAttributesData = new Map();
    data = setAssetValues(data, 1, new Map([["ca-1", 42]]));
    data = setAssetValues(data, 2, new Map([["ca-2", "keep"]]));

    const next = emptyCustomAttributesDefinition();

    const withBoth = setAttributes(withAge, "junction", [
      { id: "ca-1", label: "Age", type: "number" },
    ]);

    const moment = updateCustomAttributesDefinition(
      { definition: withBoth, data },
      next,
    );

    const putValues = moment.customAttributes?.putValues ?? [];
    expect(putValues).toHaveLength(1);
    expect(putValues[0].assetId).toBe(1);
    expect(putValues[0].values.has("ca-1")).toBe(false);
  });
});
