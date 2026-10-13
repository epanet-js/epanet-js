export type FileIntegrity = "intact" | "tampered" | "untagged";

export type FileTagVerdict = {
  body: Uint8Array;
  integrity: FileIntegrity;
  label: string | null;
};

export type FileTagger = {
  tag(database: Uint8Array): Promise<Uint8Array>;
  verify(file: Uint8Array): Promise<FileTagVerdict>;
};

export type FileTaggerFactory = (label: string) => FileTagger;

export const nullFileTagger: FileTagger = {
  tag: (database) => Promise.resolve(database),
  verify: (file) =>
    Promise.resolve({ body: file, integrity: "untagged", label: null }),
};

const nullFileTaggerFactory: FileTaggerFactory = () => nullFileTagger;

let current: FileTaggerFactory = nullFileTaggerFactory;

export const registerFileTaggerFactory = (factory: FileTaggerFactory): void => {
  current = factory;
};

export const createFileTagger = (label: string): FileTagger => current(label);

export const resetFileTaggerForTest = (): void => {
  current = nullFileTaggerFactory;
};
