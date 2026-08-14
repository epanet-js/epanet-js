import { getAppId } from "src/infra/app-instance";
import { createTempFile, isOPFSAvailable } from "./opfs-storage";
import { createInMemoryFile } from "./in-memory-file";

const openFileInOpfs = async (
  fileName: string,
): Promise<FileSystemFileHandle> => {
  const canStreamToOpfs =
    isWritableFileStreamSupported() && (await isOPFSAvailable());
  if (!canStreamToOpfs) return createInMemoryFile(fileName);

  return await createTempFile(getAppId(), fileName);
};

const openFileInFileSystem = async (
  fileName: string,
  description: string,
  mimeType: string,
  extension: string,
): Promise<FileSystemFileHandle> => {
  return await window.showSaveFilePicker({
    suggestedName: fileName,
    types: [{ description, accept: { [mimeType]: [extension] } }],
  });
};

const isFileSystemAccessSupported = () => "showSaveFilePicker" in window;

const triggerDownload = async (
  fileName: string,
  handle: FileSystemFileHandle,
) => {
  const file = await handle.getFile();
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};

const fileSizeLimit = async () => {
  if (isFileSystemAccessSupported()) return -1;

  const { quota, usage } = await navigator.storage.estimate();
  return (quota ?? 0) - (usage ?? 0);
};

const isWritableFileStreamSupported = () =>
  typeof FileSystemFileHandle !== "undefined" &&
  "createWritable" in FileSystemFileHandle.prototype;

export const FileSystemHelpers = {
  openFileInOpfs,
  openFileInFileSystem,
  isFileSystemAccessSupported,
  triggerDownload,
  fileSizeLimit,
};
