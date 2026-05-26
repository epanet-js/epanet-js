import { Zip, ZipDeflate } from "fflate";
import { ExportedFile } from "../types";

export const exportZip = async (
  handle: FileSystemFileHandle,
  exportedFiles: ExportedFile[],
) => {
  const writable = await handle.createWritable();

  await new Promise<void>((resolve, reject) => {
    const zip = new Zip(async (err, data, final) => {
      if (err) {
        reject(err);
        return;
      }
      await writable.write(data);
      if (final) resolve();
    });

    void (async () => {
      try {
        for (const file of exportedFiles) {
          const buffer = await file.blob.arrayBuffer();
          const entry = new ZipDeflate(file.fileName);
          zip.add(entry);
          entry.push(new Uint8Array(buffer), true);
        }

        zip.end();
      } catch (err) {
        reject(err);
      }
    })();
  });

  await writable.close();
};
