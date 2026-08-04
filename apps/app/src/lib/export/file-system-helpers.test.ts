import { FileSystemHelpers } from "./file-system-helpers";
import { createTempFile } from "src/infra/storage";
import { getAppId } from "src/infra/app-instance";

vi.mock("src/infra/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("src/infra/storage")>()),
  createTempFile: vi.fn(),
}));
vi.mock("src/infra/app-instance", async (importOriginal) => ({
  ...(await importOriginal<typeof import("src/infra/app-instance")>()),
  getAppId: vi.fn(),
}));

describe("openFileInOpfs", () => {
  it("creates the file inside the current app's temp OPFS directory", async () => {
    const mockHandle = {} as FileSystemFileHandle;
    vi.mocked(getAppId).mockReturnValue("test-app-id");
    vi.mocked(createTempFile).mockResolvedValue(mockHandle);

    const handle = await FileSystemHelpers.openFileInOpfs("export.zip");

    expect(createTempFile).toHaveBeenCalledWith("test-app-id", "export.zip");
    expect(handle).toBe(mockHandle);
  });
});
