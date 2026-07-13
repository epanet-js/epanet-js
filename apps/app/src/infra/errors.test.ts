import { describe, it, expect } from "vitest";
import { enrichError, catchErrors } from "./errors";

describe("enrichError", () => {
  it("wraps the message and keeps the original as cause", () => {
    const original = new Error("boom");
    const enriched = enrichError("context", original);

    expect(enriched.message).toBe("context");
    expect(enriched.cause).toBe(original);
  });
});

describe("catchErrors", () => {
  it("returns the value of a passing sync fn", () => {
    expect(catchErrors(() => 42, { as: "context" })).toBe(42);
  });

  it("enriches a sync throw", () => {
    const original = new Error("boom");
    expect(() =>
      catchErrors(
        () => {
          throw original;
        },
        { as: "context" },
      ),
    ).toThrowError(
      expect.objectContaining({ message: "context", cause: original }),
    );
  });

  it("resolves the value of a passing async fn", async () => {
    await expect(
      catchErrors(() => Promise.resolve(42), { as: "context" }),
    ).resolves.toBe(42);
  });

  it("enriches an async rejection", async () => {
    const original = new Error("boom");
    await expect(
      catchErrors(() => Promise.reject(original), { as: "context" }),
    ).rejects.toMatchObject({ message: "context", cause: original });
  });

  it("swallows a sync throw matching ignore by name", () => {
    const aborted = Object.assign(new Error("aborted"), { name: "AbortError" });
    const result = catchErrors(
      () => {
        throw aborted;
      },
      { as: "context", ignore: ["AbortError"] },
    );
    expect(result).toBeUndefined();
  });

  it("swallows an async rejection matching an ignore predicate", async () => {
    await expect(
      catchErrors(() => Promise.reject(new Error("skip me")), {
        as: "context",
        ignore: [(e) => e instanceof Error && e.message === "skip me"],
      }),
    ).resolves.toBeUndefined();
  });

  it("still enriches errors that do not match ignore", () => {
    const original = new Error("boom");
    expect(() =>
      catchErrors(
        () => {
          throw original;
        },
        { as: "context", ignore: ["AbortError"] },
      ),
    ).toThrowError(
      expect.objectContaining({ message: "context", cause: original }),
    );
  });
});
