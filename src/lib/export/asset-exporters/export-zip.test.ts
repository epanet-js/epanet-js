import JSZip from "jszip";
import { ExportedFile } from "../types";
import { exportZip } from "./export-zip";

describe("export-zip", () => {
  it("creates a zip entry for each exported file", async () => {
    const files: ExportedFile[] = [
      makeFile("junction.csv", "id,label\n1,J1"),
      makeFile("pipe.csv", "id,label\n2,P1"),
    ];
    const { zip } = await runExport(files);

    expect(Object.keys(zip.files)).toEqual(
      expect.arrayContaining(["junction.csv", "pipe.csv"]),
    );
  });

  it("preserves file contents", async () => {
    const content = "id,label\n1,J1";
    const files: ExportedFile[] = [makeFile("junction.csv", content)];
    const { zip } = await runExport(files);

    const extracted = await zip.file("junction.csv")!.async("text");
    expect(extracted).toBe(content);
  });

  it("closes the writable when done", async () => {
    const { close } = await runExport([makeFile("a.csv", "data")]);

    expect(close).toHaveBeenCalledOnce();
  });

  it("produces a valid zip for an empty file list", async () => {
    const { zip } = await runExport([]);

    expect(Object.keys(zip.files)).toHaveLength(0);
  });
});

async function runExport(files: ExportedFile[]) {
  const chunks: Uint8Array[] = [];
  const write = vi.fn((chunk: Uint8Array) => {
    chunks.push(chunk);
    return Promise.resolve();
  });
  const close = vi.fn(() => Promise.resolve());

  const handle = {
    createWritable: vi.fn(() =>
      Promise.resolve({
        write,
        close,
      } as unknown as FileSystemWritableFileStream),
    ),
  } as unknown as FileSystemFileHandle;

  await exportZip(handle, files);

  const combined = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  const zip = await JSZip.loadAsync(combined);
  return { zip, close };
}

function makeFile(fileName: string, content: string): ExportedFile {
  return {
    fileName,
    extensions: [],
    mimeTypes: [],
    description: "",
    blob: new Blob([content]),
  };
}
