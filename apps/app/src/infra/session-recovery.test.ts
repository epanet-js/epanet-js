import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  readRecoveryFingerprint,
  writeRecoveryFingerprint,
  clearRecoveryFingerprint,
} from "./session-recovery";

const createLocalStorageStub = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  };
};

describe("session recovery fingerprint", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createLocalStorageStub());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when no fingerprint is stored", () => {
    expect(readRecoveryFingerprint()).toBeNull();
  });

  it("round-trips a written fingerprint", () => {
    writeRecoveryFingerprint({
      poolId: "tab-a",
      projectName: "My model.ejsdb",
      timestamp: 123,
    });

    expect(readRecoveryFingerprint()).toEqual({
      poolId: "tab-a",
      projectName: "My model.ejsdb",
      timestamp: 123,
    });
  });

  it("clears a stored fingerprint", () => {
    writeRecoveryFingerprint({
      poolId: "tab-a",
      projectName: null,
      timestamp: 123,
    });

    clearRecoveryFingerprint();

    expect(readRecoveryFingerprint()).toBeNull();
  });

  it("returns null for malformed stored values", () => {
    localStorage.setItem("epanet-recovery", "{not valid json");

    expect(readRecoveryFingerprint()).toBeNull();
  });

  it("returns null when the stored value lacks a poolId", () => {
    localStorage.setItem("epanet-recovery", JSON.stringify({ timestamp: 1 }));

    expect(readRecoveryFingerprint()).toBeNull();
  });
});
