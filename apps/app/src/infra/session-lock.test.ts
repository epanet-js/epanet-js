import { describe, it, expect, afterEach, vi } from "vitest";
import { holdSessionLock, isSessionAlive } from "./session-lock";

type LockCallback = (lock: { name: string } | null) => unknown;

const createLockManagerStub = () => {
  const held = new Set<string>();
  return {
    held,
    request: (
      name: string,
      optionsOrCallback: { ifAvailable?: boolean } | LockCallback,
      maybeCallback?: LockCallback,
    ): Promise<unknown> => {
      const callback =
        typeof optionsOrCallback === "function"
          ? optionsOrCallback
          : (maybeCallback as LockCallback);
      const options =
        typeof optionsOrCallback === "function" ? {} : optionsOrCallback;

      if (options.ifAvailable && held.has(name)) {
        return Promise.resolve(callback(null));
      }

      held.add(name);
      const result = callback({ name });
      void Promise.resolve(result)
        .catch(() => undefined)
        .finally(() => held.delete(name));
      return Promise.resolve(result);
    },
  };
};

const stubLocks = (locks: unknown) => {
  vi.stubGlobal("navigator", { locks });
};

describe("session lock", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports a session as alive while its lock is held", async () => {
    stubLocks(createLockManagerStub());

    await holdSessionLock("tab-a");

    expect(await isSessionAlive("tab-a")).toBe(true);
  });

  it("reports a session as dead when its lock was never taken", async () => {
    stubLocks(createLockManagerStub());

    expect(await isSessionAlive("tab-a")).toBe(false);
  });

  it("does not keep the lock held after probing a dead session", async () => {
    const locks = createLockManagerStub();
    stubLocks(locks);

    await isSessionAlive("tab-a");
    await vi.waitFor(() => expect(locks.held.size).toBe(0));

    expect(await isSessionAlive("tab-a")).toBe(false);
  });

  it("scopes liveness to the probed session id", async () => {
    stubLocks(createLockManagerStub());

    await holdSessionLock("tab-a");

    expect(await isSessionAlive("tab-b")).toBe(false);
  });

  it("treats sessions as dead when Web Locks is unavailable", async () => {
    stubLocks(undefined);

    await expect(holdSessionLock("tab-a")).resolves.toBeUndefined();
    expect(await isSessionAlive("tab-a")).toBe(false);
  });

  it("treats sessions as dead when the lock request fails", async () => {
    stubLocks({ request: () => Promise.reject(new Error("denied")) });

    await expect(holdSessionLock("tab-a")).resolves.toBeUndefined();
    expect(await isSessionAlive("tab-a")).toBe(false);
  });
});
