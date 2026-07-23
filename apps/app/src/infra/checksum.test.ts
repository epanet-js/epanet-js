import { describe, it, expect } from "vitest";
import crc32 from "crc/crc32";
import { checksum } from "./checksum";

// Reference: the whole-string CRC-32 (the behaviour before chunking).
const wholeStringCrc = (content: string) =>
  crc32(content).toString(16).padStart(8, "0");

describe("checksum", () => {
  it("matches known CRC-32 values", () => {
    expect(checksum("")).toBe("00000000");
    expect(checksum("a")).toBe("e8b7be43");
    expect(checksum("abc")).toBe("352441c2");
    expect(checksum("MADE BY EPANET-JS")).toBe("aa04c8b8");
  });

  it("is independent of chunk size (chunked === whole string)", () => {
    const cases = [
      "",
      "a",
      "MADE BY EPANET-JS",
      "x".repeat(1000),
      "héllo wörld ".repeat(50), // multi-byte UTF-8
      "😀 astral 😀 test ".repeat(30), // surrogate pairs
    ];
    for (const content of cases) {
      const expected = wholeStringCrc(content);
      for (const chunkSize of [1, 2, 3, 7, 64, 1000, 1 << 20]) {
        expect(checksum(content, chunkSize)).toBe(expected);
      }
    }
  });

  it("keeps surrogate pairs intact across chunk boundaries", () => {
    // Emojis are surrogate pairs (2 UTF-16 code units); with tiny chunk sizes a
    // boundary falls between the halves, so the guard is exercised at every one.
    const content = "ab😀cd😀ef😀";
    const expected = wholeStringCrc(content);
    for (const chunkSize of [1, 2, 3, 4, 5]) {
      expect(checksum(content, chunkSize)).toBe(expected);
    }
  });
});
