import crc32 from "crc/crc32";

export const checksum = (content: string): string => {
  return crc32(content).toString(16);
};
