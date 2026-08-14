import { FileSystemHelpers } from "./file-system-helpers";
import { createTempFile, isOPFSAvailable } from "./opfs-storage";
import { getAppId } from "src/infra/app-instance";

vi.mock("./opfs-storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./opfs-storage")>()),
  createTempFile: vi.fn(),
  isOPFSAvailable: vi.fn(),
}));
vi.mock("src/infra/app-instance", async (importOriginal) => ({
  ...(await importOriginal<typeof import("src/infra/app-instance")>()),
  getAppId: vi.fn(),
}));

describe("openFileInOpfs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAppId).mockReturnValue("test-app-id");
    vi.mocked(isOPFSAvailable).mockResolvedValue(true);
    vi.stubGlobal(
      "FileSystemFileHandle",
      class FileSystemFileHandle {
        createWritable() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates the file inside the current app's temp OPFS directory", async () => {
    const mockHandle = {} as FileSystemFileHandle;
    vi.mocked(createTempFile).mockResolvedValue(mockHandle);

    const handle = await FileSystemHelpers.openFileInOpfs("export.zip");

    expect(createTempFile).toHaveBeenCalledWith("test-app-id", "export.zip");
    expect(handle).toBe(mockHandle);
  });

  describe("when the file cannot be streamed to OPFS", () => {
    it("falls back to memory when OPFS is unavailable", async () => {
      vi.mocked(isOPFSAvailable).mockResolvedValue(false);

      const handle = await FileSystemHelpers.openFileInOpfs("export.inp");

      expect(createTempFile).not.toHaveBeenCalled();
      expect(handle.name).toEqual("export.inp");
    });

    it("falls back to memory when the browser has no writable file streams", async () => {
      vi.stubGlobal("FileSystemFileHandle", class FileSystemFileHandle {});

      const handle = await FileSystemHelpers.openFileInOpfs("export.inp");

      expect(createTempFile).not.toHaveBeenCalled();
      expect(handle.name).toEqual("export.inp");
    });

    it("keeps everything written to it", async () => {
      vi.mocked(isOPFSAvailable).mockResolvedValue(false);

      const handle = await FileSystemHelpers.openFileInOpfs("export.inp");
      const writable = await handle.createWritable();
      await writable.write("[JUNCTIONS]\n");
      await writable.write("J1\n");
      await writable.close();

      const file = await handle.getFile();
      expect(await file.text()).toEqual("[JUNCTIONS]\nJ1\n");
    });

    it("discards the content when the write is aborted", async () => {
      vi.mocked(isOPFSAvailable).mockResolvedValue(false);

      const handle = await FileSystemHelpers.openFileInOpfs("export.inp");
      const writable = await handle.createWritable();
      await writable.write("[JUNCTIONS]\n");
      await writable.abort();

      const file = await handle.getFile();
      expect(file.size).toEqual(0);
    });
  });
});
