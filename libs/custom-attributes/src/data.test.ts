import {
  emptyCustomAttributesData,
  getValue,
  removeAttributes,
  setValue,
} from "./data";

describe("removeAttributes", () => {
  it("deletes the given attribute ids from every asset", () => {
    let data = emptyCustomAttributesData();
    data = setValue(data, 1, "ca-1", "Alice");
    data = setValue(data, 1, "ca-2", 10);
    data = setValue(data, 2, "ca-1", "Bob");

    const next = removeAttributes(data, new Set(["ca-1"]));

    expect(getValue(next, 1, "ca-1")).toBeNull();
    expect(getValue(next, 2, "ca-1")).toBeNull();
    expect(getValue(next, 1, "ca-2")).toEqual(10);
  });

  it("drops asset entries that become empty", () => {
    let data = emptyCustomAttributesData();
    data = setValue(data, 1, "ca-1", "Alice");

    const next = removeAttributes(data, new Set(["ca-1"]));

    expect(next.has(1)).toBe(false);
  });

  it("returns the same reference when nothing matches", () => {
    let data = emptyCustomAttributesData();
    data = setValue(data, 1, "ca-1", "Alice");

    expect(removeAttributes(data, new Set(["ca-99"]))).toBe(data);
    expect(removeAttributes(data, new Set())).toBe(data);
  });
});
