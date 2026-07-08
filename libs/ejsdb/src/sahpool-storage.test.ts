import {
  cleanupStaleDbPools,
  sahpoolDirectory,
  sahpoolPoolName,
} from "./sahpool-storage";

async function* asyncNames(names: string[]): AsyncGenerator<string> {
  await Promise.resolve();
  for (const name of names) yield name;
}

describe("sahpool path builders", () => {
  it("builds the pool directory and name under the epanet-db root", () => {
    expect(sahpoolDirectory("tab-a")).toBe("/epanet-db/tab-a");
    expect(sahpoolPoolName("tab-a")).toBe("epanet-db-tab-a");
  });
});

describe("cleanupStaleDbPools", () => {
  let mockPoolRoot: {
    keys: ReturnType<typeof vi.fn>;
    removeEntry: ReturnType<typeof vi.fn>;
  };
  let mockRoot: { getDirectoryHandle: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockPoolRoot = {
      keys: vi.fn(() => asyncNames([])),
      removeEntry: vi.fn().mockResolvedValue(undefined),
    };
    mockRoot = {
      getDirectoryHandle: vi.fn().mockResolvedValue(mockPoolRoot),
    };
    vi.stubGlobal("navigator", {
      storage: { getDirectory: vi.fn().mockResolvedValue(mockRoot) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("removes every pool directory except the current id", async () => {
    mockPoolRoot.keys.mockReturnValue(
      asyncNames(["old-tab-1", "current-tab", "old-tab-2"]),
    );

    await cleanupStaleDbPools("current-tab");

    expect(mockRoot.getDirectoryHandle).toHaveBeenCalledWith("epanet-db");
    expect(mockPoolRoot.removeEntry).toHaveBeenCalledWith("old-tab-1", {
      recursive: true,
    });
    expect(mockPoolRoot.removeEntry).toHaveBeenCalledWith("old-tab-2", {
      recursive: true,
    });
    expect(mockPoolRoot.removeEntry).not.toHaveBeenCalledWith(
      "current-tab",
      expect.anything(),
    );
  });

  it("does nothing when the pool root does not exist yet", async () => {
    mockRoot.getDirectoryHandle.mockRejectedValue(new Error("NotFoundError"));

    await expect(cleanupStaleDbPools("current-tab")).resolves.not.toThrow();
    expect(mockPoolRoot.removeEntry).not.toHaveBeenCalled();
  });

  it("ignores pools that cannot be removed because a live tab holds them", async () => {
    mockPoolRoot.keys.mockReturnValue(asyncNames(["live-tab"]));
    mockPoolRoot.removeEntry.mockRejectedValue(
      new Error("NoModificationAllowedError"),
    );

    await expect(cleanupStaleDbPools("current-tab")).resolves.not.toThrow();
  });

  it("returns early when OPFS is unavailable", async () => {
    vi.stubGlobal("navigator", undefined);

    await cleanupStaleDbPools("current-tab");

    expect(mockPoolRoot.removeEntry).not.toHaveBeenCalled();
  });
});
