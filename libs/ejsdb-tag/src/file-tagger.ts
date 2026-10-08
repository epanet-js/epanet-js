export type FileIntegrity = "intact" | "tampered" | "untagged";

export type FileTagVerdict = {
  body: Uint8Array;
  integrity: FileIntegrity;
  label: string | null;
};

export type FileTagger = {
  tag(database: Uint8Array, label: string): Promise<Uint8Array>;
  verify(file: Uint8Array): Promise<FileTagVerdict>;
};

export const nullFileTagger: FileTagger = {
  tag: (database) => Promise.resolve(database),
  verify: (file) =>
    Promise.resolve({ body: file, integrity: "untagged", label: null }),
};

let current: FileTagger = nullFileTagger;

export const registerFileTagger = (tagger: FileTagger): void => {
  current = tagger;
};

export const getFileTagger = (): FileTagger => current;

export const resetFileTaggerForTest = (): void => {
  current = nullFileTagger;
};
