import { junctionPatchRowSchema, pumpPatchRowSchema } from "./patches";

describe("asset patch row schemas", () => {
  it("requires id but allows other columns to be omitted", () => {
    const result = junctionPatchRowSchema.safeParse({ id: 1, label: "X" });
    expect(result.success).toBe(true);
  });

  it("rejects a patch missing id", () => {
    const result = junctionPatchRowSchema.safeParse({ label: "X" });
    expect(result.success).toBe(false);
  });

  it("rejects a patch with a wrong-typed value for a known column", () => {
    const result = junctionPatchRowSchema.safeParse({ id: 1, is_active: 5 });
    expect(result.success).toBe(false);
  });

  it("rejects a pump patch with bogus definition_type", () => {
    const result = pumpPatchRowSchema.safeParse({
      id: 1,
      definition_type: "nope",
    });
    expect(result.success).toBe(false);
  });
});
