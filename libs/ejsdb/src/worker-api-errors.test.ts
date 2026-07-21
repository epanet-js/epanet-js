import { normalizeError, withErrorNormalization } from "./worker-api-errors";

describe("normalizeError", () => {
  it("returns real errors untouched", () => {
    const error = new Error("boom");

    expect(normalizeError(error)).toBe(error);
  });

  it("converts a DOMException into an Error keeping name, message and stack", () => {
    const domException = new DOMException(
      "The object is in an invalid state.",
      "InvalidStateError",
    );
    const stack = "OpfsSAHPool.getFileForPath@sqlite3.js:123";
    Object.defineProperty(domException, "stack", { value: stack });

    const normalized = normalizeError(domException);

    expect(normalized).toBeInstanceOf(Error);
    expect(normalized.name).toBe("InvalidStateError");
    expect(normalized.message).toBe("The object is in an invalid state.");
    expect(normalized.stack).toBe(stack);
  });

  it("keeps name and message when the thrown value has no stack", () => {
    const domException = new DOMException("denied", "NotAllowedError");
    Object.defineProperty(domException, "stack", { value: undefined });

    const normalized = normalizeError(domException);

    expect(normalized.name).toBe("NotAllowedError");
    expect(normalized.message).toBe("denied");
  });

  it("stringifies values without an error shape", () => {
    const normalized = normalizeError("plain failure");

    expect(normalized).toBeInstanceOf(Error);
    expect(normalized.message).toBe("plain failure");
  });
});

describe("withErrorNormalization", () => {
  const domException = () =>
    new DOMException("invalid state", "InvalidStateError");

  it("normalizes rejections from async methods", async () => {
    const api = withErrorNormalization({
      fail: () => Promise.reject(domException()),
    });

    const rejection = await api.fail().catch((e: unknown) => e);

    expect(rejection).toBeInstanceOf(Error);
    expect((rejection as Error).name).toBe("InvalidStateError");
  });

  it("normalizes synchronous throws", () => {
    const api = withErrorNormalization({
      fail: () => {
        throw domException();
      },
    });

    let thrown: unknown;
    try {
      api.fail();
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).name).toBe("InvalidStateError");
  });

  it("returns resolved values unchanged", async () => {
    const api = withErrorNormalization({
      get: (value: number) => Promise.resolve(value * 2),
    });

    await expect(api.get(21)).resolves.toBe(42);
  });

  it("leaves non-function properties in place", () => {
    const api = withErrorNormalization({ version: 3, get: () => "ok" });

    expect(api.version).toBe(3);
    expect(api.get()).toBe("ok");
  });
});
