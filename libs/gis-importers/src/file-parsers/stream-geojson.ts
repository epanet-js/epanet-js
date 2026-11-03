import type { Feature } from "geojson";

const OPEN_OBJECT = 0x7b;
const CLOSE_OBJECT = 0x7d;
const OPEN_ARRAY = 0x5b;
const CLOSE_ARRAY = 0x5d;
const QUOTE = 0x22;
const BACKSLASH = 0x5c;
const COLON = 0x3a;
const COMMA = 0x2c;
const NEWLINE = 0x0a;

const isWhitespace = (byte: number): boolean =>
  byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d;

class Malformed extends Error {}

const isFeature = (candidate: unknown): candidate is Feature =>
  (candidate as Feature | null)?.type === "Feature";

/**
 * Reads a FeatureCollection one feature at a time, so the whole document is
 * never held as objects. Null when the bytes are not a FeatureCollection.
 */
export const streamFeatureCollection = (
  bytes: Uint8Array,
  onFeature: (feature: Feature) => void,
): { crs: unknown } | null => {
  const decoder = new TextDecoder();
  const length = bytes.length;

  const skipWhitespace = (at: number): number => {
    while (at < length && isWhitespace(bytes[at])) at++;
    return at;
  };

  const skipString = (at: number): number => {
    for (let i = at + 1; i < length; i++) {
      const byte = bytes[i];
      if (byte === BACKSLASH) i++;
      else if (byte === QUOTE) return i + 1;
    }
    throw new Malformed();
  };

  const skipValue = (at: number): number => {
    const first = bytes[at];
    if (first === QUOTE) return skipString(at);
    if (first === OPEN_OBJECT || first === OPEN_ARRAY) {
      let depth = 0;
      for (let i = at; i < length; i++) {
        const byte = bytes[i];
        if (byte === QUOTE) {
          i = skipString(i) - 1;
        } else if (byte === OPEN_OBJECT || byte === OPEN_ARRAY) {
          depth++;
        } else if (byte === CLOSE_OBJECT || byte === CLOSE_ARRAY) {
          depth--;
          if (depth === 0) return i + 1;
        }
      }
      throw new Malformed();
    }
    let i = at;
    while (
      i < length &&
      bytes[i] !== COMMA &&
      bytes[i] !== CLOSE_OBJECT &&
      bytes[i] !== CLOSE_ARRAY &&
      !isWhitespace(bytes[i])
    ) {
      i++;
    }
    if (i === at) throw new Malformed();
    return i;
  };

  const parse = (from: number, to: number): unknown =>
    JSON.parse(decoder.decode(bytes.subarray(from, to)));

  const expect = (at: number, byte: number): void => {
    if (bytes[at] !== byte) throw new Malformed();
  };

  try {
    let at = skipWhitespace(startOf(bytes));
    expect(at, OPEN_OBJECT);
    at = skipWhitespace(at + 1);

    let type: unknown;
    let crs: unknown = null;

    while (bytes[at] !== CLOSE_OBJECT) {
      expect(at, QUOTE);
      const keyEnd = skipString(at);
      const key = parse(at, keyEnd);
      at = skipWhitespace(keyEnd);
      expect(at, COLON);
      at = skipWhitespace(at + 1);

      if (key === "features" && bytes[at] === OPEN_ARRAY) {
        at = skipWhitespace(at + 1);
        while (bytes[at] !== CLOSE_ARRAY) {
          const end = skipValue(at);
          const candidate = parse(at, end);
          if (isFeature(candidate)) onFeature(candidate);
          at = skipWhitespace(end);
          if (bytes[at] === COMMA) at = skipWhitespace(at + 1);
          else expect(at, CLOSE_ARRAY);
        }
        at += 1;
      } else {
        const end = skipValue(at);
        if (key === "type") type = parse(at, end);
        else if (key === "crs") crs = parse(at, end);
        at = end;
      }

      at = skipWhitespace(at);
      if (bytes[at] === COMMA) at = skipWhitespace(at + 1);
      else expect(at, CLOSE_OBJECT);
    }

    if (skipWhitespace(at + 1) !== length) return null;
    return type === "FeatureCollection" ? { crs } : null;
  } catch (error) {
    if (error instanceof Malformed || error instanceof SyntaxError) return null;
    throw error;
  }
};

/** One feature per line; lines that are not a feature are left out. */
export const streamFeatureLines = (
  bytes: Uint8Array,
  onFeature: (feature: Feature) => void,
): number => {
  const decoder = new TextDecoder();
  let found = 0;
  let from = startOf(bytes);

  while (from < bytes.length) {
    let to = bytes.indexOf(NEWLINE, from);
    if (to === -1) to = bytes.length;
    const line = decoder.decode(bytes.subarray(from, to));
    from = to + 1;
    if (!line.trim()) continue;
    try {
      const candidate: unknown = JSON.parse(line);
      if (isFeature(candidate)) {
        onFeature(candidate);
        found += 1;
      }
    } catch {
      continue;
    }
  }

  return found;
};

const startOf = (bytes: Uint8Array): number =>
  bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
