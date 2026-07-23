import crc32 from "crc/crc32";

// Hash in chunks so very large content never builds a single oversized buffer:
// crc's `Buffer.from(content)` throws `RangeError: Invalid array length` once
// the UTF-8 byte array passes JS's max array length. crc32 is incremental
// (`crc32(b, crc32(a)) === crc32(a + b)`), so chunking yields the same result
// as hashing the whole string.
const CHUNK_SIZE = 1 << 20; // 1 MiB of UTF-16 code units

// `chunkSize` is result-invariant (any value yields the same hash) — exposed
// only so tests can force the loop with small inputs.
export const checksum = (content: string, chunkSize = CHUNK_SIZE): string => {
  // Seed is `undefined`, not 0: crc's `crc32(value, 0)` differs from
  // `crc32(value)`, so passing 0 for the first chunk would change the hash.
  let crc: number | undefined;
  for (let i = 0; i < content.length; ) {
    let end = Math.min(i + chunkSize, content.length);
    // Never split a surrogate pair across chunks, or the two halves would
    // encode differently than the whole and change the hash.
    if (end < content.length) {
      const last = content.charCodeAt(end - 1);
      if (last >= 0xd800 && last <= 0xdbff) end += 1;
    }
    crc = crc32(content.slice(i, end), crc);
    i = end;
  }
  return (crc ?? 0).toString(16).padStart(8, "0");
};
