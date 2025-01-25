export const aTestFile = ({
  filename = "my-file.txt",
  content = "",
}: {
  filename?: string;
  content?: string | Blob | ArrayBuffer;
}): File => {
  const file = new File([content], filename);
  if (!file.arrayBuffer) {
    file.arrayBuffer = () => mockArrayBufferImplementation(file);
  }
  return file;
};

const mockArrayBufferImplementation = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (): void => {
      const content = reader.result;
      resolve(content as ArrayBuffer);
    };
    reader.readAsArrayBuffer(file);
  });
};
