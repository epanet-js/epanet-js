const openFileInOpfs = async (
  fileName: string,
): Promise<FileSystemFileHandle> => {
  const directory = await navigator.storage.getDirectory();
  return await directory.getFileHandle(fileName, {
    create: true,
  });
};

const openFileInFileSystem = async (
  fileName: string,
): Promise<FileSystemFileHandle> => {
  return await window.showSaveFilePicker({
    suggestedName: fileName,
    types: [{ description: "ZIP", accept: { "application/zip": [".zip"] } }],
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

export const FileSystemHelpers = {
  openFileInOpfs,
  openFileInFileSystem,
  isFileSystemAccessSupported,
  triggerDownload,
};
