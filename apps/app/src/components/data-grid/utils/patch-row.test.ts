import { describe, expect, it } from "vitest";
import { defaultPatchRow, patchModelRow } from "./patch-row";

describe("defaultPatchRow", () => {
  it("shallow-merges patches over a plain row", () => {
    const row = { id: "1", label: "A", value: 1 };
    const patched = defaultPatchRow(row, { value: 2 });
    expect(patched).toEqual({ id: "1", label: "A", value: 2 });
    expect(patched).not.toBe(row);
  });
});

describe("patchModelRow", () => {
  // Mimics a model object: attributes are exposed via prototype getters, not
  // own enumerable properties (so an object spread would drop them).
  class ModelLike {
    constructor(
      public readonly id: string,
      private readonly _label: string,
      private readonly _elevation: number,
    ) {}
    get label() {
      return this._label;
    }
    get elevation() {
      return this._elevation;
    }
  }

  it("overrides edited keys while preserving getter-backed attributes", () => {
    const row = new ModelLike("1", "J1", 10) as unknown as Record<
      string,
      unknown
    >;
    const patched = patchModelRow(row, { elevation: 42 });

    expect(patched.elevation).toBe(42); // edited (own override)
    expect(patched.label).toBe("J1"); // unedited (inherited getter)
    expect(patched.id).toBe("1"); // inherited own prop
  });

  it("exposes only the edited columns as own enumerable keys", () => {
    const row = new ModelLike("1", "J1", 10) as unknown as Record<
      string,
      unknown
    >;
    const patched = patchModelRow(row, { elevation: 42, label: "J9" });

    expect(Object.keys(patched).sort()).toEqual(["elevation", "label"]);
  });

  it("does not mutate the original row", () => {
    const row = new ModelLike("1", "J1", 10) as unknown as Record<
      string,
      unknown
    >;
    patchModelRow(row, { elevation: 42 });
    expect(row.elevation).toBe(10);
  });
});
