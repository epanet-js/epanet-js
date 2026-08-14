export const createInMemoryFile = (fileName: string): FileSystemFileHandle => {
  let chunks: BlobPart[] = [];

  const writable = {
    write: (chunk: BlobPart) => {
      chunks.push(chunk);
      return Promise.resolve();
    },
    close: () => Promise.resolve(),
    abort: () => {
      chunks = [];
      return Promise.resolve();
    },
  };

  return {
    kind: "file",
    name: fileName,
    createWritable: () => Promise.resolve(writable),
    getFile: () => Promise.resolve(new File(chunks, fileName)),
  } as unknown as FileSystemFileHandle;
};
