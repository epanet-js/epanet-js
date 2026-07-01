import {
  type CustomAttribute,
  type CustomAttributeId,
  type CustomAttributesDefinition,
  emptyCustomAttributesData,
  emptyCustomAttributesDefinition,
  getValue,
  setAttributes,
  setValue,
} from "@epanet-js/custom-attributes";
import { applyMomentToCustomAttributes } from "./apply-moment";

const definitionWith = (
  ids: CustomAttributeId[],
): CustomAttributesDefinition => {
  const attributes: CustomAttribute[] = ids.map((id) => ({
    id,
    label: id,
    type: "text",
  }));
  return setAttributes(
    emptyCustomAttributesDefinition(),
    "junction",
    attributes,
  );
};

describe("applyMomentToCustomAttributes", () => {
  it("applies value changes and returns a reverse restoring the prior value", () => {
    const initial = setValue(emptyCustomAttributesData(), 7, "ca-1", "Alice");
    const definition = definitionWith(["ca-1"]);

    const { data, reverse } = applyMomentToCustomAttributes(
      initial,
      definition,
      {
        putValues: [{ assetId: 7, values: new Map([["ca-1", "Bob"]]) }],
      },
    );

    expect(getValue(data, 7, "ca-1")).toEqual("Bob");
    expect(getValue(initial, 7, "ca-1")).toEqual("Alice");

    const restored = applyMomentToCustomAttributes(data, definition, reverse);
    expect(getValue(restored.data, 7, "ca-1")).toEqual("Alice");
  });

  it("captures null as the prior value when none was set", () => {
    const { reverse } = applyMomentToCustomAttributes(
      emptyCustomAttributesData(),
      definitionWith(["ca-2"]),
      { putValues: [{ assetId: 3, values: new Map([["ca-2", 42]]) }] },
    );

    expect(reverse.putValues).toEqual([
      { assetId: 3, values: new Map([["ca-2", null]]) },
    ]);
    expect(reverse.putDefinition).toBeUndefined();
  });

  it("swaps the definition and reverses to the previous one", () => {
    const previous = definitionWith(["ca-1"]);
    const next = definitionWith(["ca-1", "ca-2"]);

    const { definition, reverse } = applyMomentToCustomAttributes(
      emptyCustomAttributesData(),
      previous,
      { putValues: [], putDefinition: next },
    );

    expect(definition).toBe(next);
    expect(reverse.putDefinition).toBe(previous);
  });

  it("removes an attribute's values forward and restores them on reverse", () => {
    const withTwo = definitionWith(["ca-1", "ca-2"]);
    const withOne = definitionWith(["ca-1"]);
    let data = setValue(emptyCustomAttributesData(), 7, "ca-1", "Alice");
    data = setValue(data, 7, "ca-2", "secret");

    const removal = applyMomentToCustomAttributes(data, withTwo, {
      putValues: [{ assetId: 7, values: new Map([["ca-1", "Alice"]]) }],
      putDefinition: withOne,
    });

    expect(getValue(removal.data, 7, "ca-2")).toBeNull();
    expect(getValue(removal.data, 7, "ca-1")).toEqual("Alice");
    // reverse retains the removed value so undo can restore it
    expect(removal.reverse.putValues[0].values.get("ca-2")).toEqual("secret");
    expect(removal.reverse.putDefinition).toBe(withTwo);

    const undo = applyMomentToCustomAttributes(
      removal.data,
      removal.definition,
      removal.reverse,
    );
    expect(undo.definition).toBe(withTwo);
    expect(getValue(undo.data, 7, "ca-2")).toEqual("secret");
    expect(getValue(undo.data, 7, "ca-1")).toEqual("Alice");
  });
});
