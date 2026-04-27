import JSZip from "jszip";
import { ExportedFile } from "../types";

export const exportZip = async (
  fileName: string,
  exportedFiles: ExportedFile[],
): Promise<ExportedFile> => {
  const zip = new JSZip();

  exportedFiles.forEach((file) => {
    zip.file(file.fileName, file.blob);
  });

  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/zip",
  });

  return {
    fileName: `${fileName}.zip`,
    extensions: [".zip"],
    mimeTypes: ["application/zip"],
    description: ".ZIP Compressed File",
    blob,
  };
};
