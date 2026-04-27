// @vitest-environment jsdom
import JSZip from "jszip";
import { ExportedFile } from "../types";
import { exportZip } from "./export-zip";

const makeFile = (fileName: string, content: string): ExportedFile => ({
  fileName,
  extensions: [".txt"],
  mimeTypes: ["text/plain"],
  description: "Plain Text File",
  blob: new Blob([content], { type: "text/plain" }),
});

describe("export-zip", () => {
  it("returns correct metadata", async () => {
    const result = await exportZip("my-export", [makeFile("a.txt", "hello")]);

    expect(result.fileName).toBe("my-export.zip");
    expect(result.extensions).toEqual([".zip"]);
    expect(result.mimeTypes).toEqual(["application/zip"]);
    expect(result.description).toBe(".ZIP Compressed File");
  });

  it("zip file content matches original blobs", async () => {
    const firstContent = "hello";
    const secondContent = "world";
    const files = [
      makeFile("a.txt", firstContent),
      makeFile("b.txt", secondContent),
    ];

    const result = await exportZip("export", files);

    const zip = await JSZip.loadAsync(result.blob);
    expect(zip.file("a.txt")).not.toBeNull();
    expect(zip.file("b.txt")).not.toBeNull();
    expect(await zip.file("a.txt")!.async("text")).toBe(firstContent);
    expect(await zip.file("b.txt")!.async("text")).toBe(secondContent);
  });
});
