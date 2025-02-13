vi.mock("browser-fs-access", () => ({
  supported: true,
  fileSave: vi.fn(),
  fileOpen: vi.fn(() => {
    let input = document.querySelector(
      '[data-testid="file-upload"]',
    ) as HTMLInputElement;
    if (!input) {
      input = document.createElement("input");
      input.type = "file";
      input.setAttribute("data-testid", "file-upload");
      document.body.appendChild(input);
    }
    return new Promise((resolve) => {
      input.addEventListener("change", () => {
        resolve(input.files![0]);
      });
    });
  }),
}));

import { fileSave, fileOpen, FileWithHandle } from "browser-fs-access";
import { Mock } from "vitest";

export const stubFileOpen = (handle = buildFileSystemHandleMock()) => {
  (fileOpen as Mock).mockImplementation(() => {
    let input = document.querySelector(
      '[data-testid="file-upload"]',
    ) as HTMLInputElement;
    if (!input) {
      input = document.createElement("input");
      input.type = "file";
      input.setAttribute("data-testid", "file-upload");
      document.body.appendChild(input);
    }
    return new Promise((resolve) => {
      input.addEventListener("change", () => {
        const fileWithHandle: FileWithHandle = input.files![0];
        fileWithHandle.handle = handle;
        resolve(fileWithHandle);
      });
    });
  });
  return handle;
};

export const stubFileSave = ({
  handle,
  fileName = "test.inp",
}: {
  handle?: FileSystemFileHandle;
  fileName?: string;
} = {}) => {
  const effectiveHandle = handle
    ? handle
    : buildFileSystemHandleMock({ fileName });

  (fileSave as Mock).mockResolvedValue(effectiveHandle);
  return effectiveHandle;
};

export const stubFileSaveError = () => {
  (fileSave as Mock).mockRejectedValue(new Error("Something went wrong"));
};

export const lastSaveCall = () => {
  const [contentBlob, options, handle] = (fileSave as Mock).mock
    .lastCall as any[];

  return {
    contentBlob,
    options,
    handle,
  };
};

export const buildFileSystemHandleMock = ({
  fileName = "mock.txt",
}: {
  fileName?: string;
} = {}): FileSystemFileHandle =>
  ({
    name: fileName,
    kind: "file",
    getFile: vi.fn(() =>
      Promise.resolve(
        new File(["mock content"], fileName, { type: "text/plain" }),
      ),
    ),
  }) as unknown as FileSystemFileHandle;
