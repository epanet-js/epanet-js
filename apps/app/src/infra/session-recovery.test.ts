import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  readRecoveryFingerprints,
  writeRecoveryFingerprint,
  clearRecoveryFingerprint,
  clearRecoveryFingerprints,
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

  it("returns an empty list when no fingerprint is stored", () => {
    expect(readRecoveryFingerprints()).toEqual([]);
  });

  it("round-trips a written fingerprint", () => {
    writeRecoveryFingerprint({
      poolId: "tab-a",
      projectName: "My model.ejsdb",
      timestampLastModelChange: 456,
      timestampLastSave: 123,
    });

    expect(readRecoveryFingerprints()).toEqual([
      {
        poolId: "tab-a",
        projectName: "My model.ejsdb",
        timestampLastModelChange: 456,
        timestampLastSave: 123,
      },
    ]);
  });

  it("keeps fingerprints from several tabs at once", () => {
    writeRecoveryFingerprint({
      poolId: "tab-a",
      projectName: "A.ejsdb",
      timestampLastModelChange: 100,
    });
    writeRecoveryFingerprint({
      poolId: "tab-b",
      projectName: "B.ejsdb",
      timestampLastModelChange: 200,
    });

    const poolIds = readRecoveryFingerprints().map((f) => f.poolId);
    expect(poolIds).toEqual(expect.arrayContaining(["tab-a", "tab-b"]));
    expect(poolIds).toHaveLength(2);
  });

  it("replaces the fingerprint for a pool that is written again", () => {
    writeRecoveryFingerprint({
      poolId: "tab-a",
      projectName: "A.ejsdb",
      timestampLastModelChange: 100,
    });
    writeRecoveryFingerprint({
      poolId: "tab-a",
      projectName: "A.ejsdb",
      timestampLastModelChange: 300,
    });

    const fingerprints = readRecoveryFingerprints();
    expect(fingerprints).toHaveLength(1);
    expect(fingerprints[0].timestampLastModelChange).toEqual(300);
  });

  it("round-trips a fingerprint for a project never saved", () => {
    writeRecoveryFingerprint({
      poolId: "tab-a",
      projectName: null,
      timestampLastModelChange: 456,
      timestampLastSave: undefined,
    });

    const [fingerprint] = readRecoveryFingerprints();

    expect(fingerprint.timestampLastModelChange).toEqual(456);
    expect(fingerprint.timestampLastSave).toBeUndefined();
  });

  it("clears a single fingerprint by pool id, leaving the rest", () => {
    writeRecoveryFingerprint({
      poolId: "tab-a",
      projectName: null,
      timestampLastModelChange: 100,
    });
    writeRecoveryFingerprint({
      poolId: "tab-b",
      projectName: null,
      timestampLastModelChange: 200,
    });

    clearRecoveryFingerprint("tab-a");

    expect(readRecoveryFingerprints().map((f) => f.poolId)).toEqual(["tab-b"]);
  });

  it("clears several fingerprints at once", () => {
    for (const poolId of ["tab-a", "tab-b", "tab-c"]) {
      writeRecoveryFingerprint({
        poolId,
        projectName: null,
        timestampLastModelChange: 1,
      });
    }

    clearRecoveryFingerprints(["tab-a", "tab-c"]);

    expect(readRecoveryFingerprints().map((f) => f.poolId)).toEqual(["tab-b"]);
  });

  it("removes the storage key once the last fingerprint is cleared", () => {
    writeRecoveryFingerprint({
      poolId: "tab-a",
      projectName: null,
      timestampLastModelChange: 456,
    });

    clearRecoveryFingerprint("tab-a");

    expect(localStorage.getItem("epanet-recovery")).toBeNull();
  });

  it("returns an empty list for malformed stored values", () => {
    localStorage.setItem("epanet-recovery", "{not valid json");

    expect(readRecoveryFingerprints()).toEqual([]);
  });

  it("ignores stored entries that lack a poolId", () => {
    localStorage.setItem(
      "epanet-recovery",
      JSON.stringify({ "tab-a": { timestampLastModelChange: 1 } }),
    );

    expect(readRecoveryFingerprints()).toEqual([]);
  });
});
