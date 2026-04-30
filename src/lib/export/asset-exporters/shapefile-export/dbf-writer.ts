import { type AssetWriter } from "./asset-writer";

export function writeDbfHeader(w: AssetWriter): void {
  const now = new Date();
  const view = w.dbfView;
  const numFields = w.frozenSchema.length;

  view.setUint8(0, 0x03); // dBase III, no memo
  view.setUint8(1, now.getFullYear() - 1900);
  view.setUint8(2, now.getMonth() + 1); // getMonth() is 0-indexed
  view.setUint8(3, now.getDate());
  view.setUint32(4, w.recordCount, true); // record count, little-endian
  view.setUint16(8, 32 + 32 * numFields + 1, true); // header length, little-endian
  view.setUint16(10, w.recordLength, true); // record length, little-endian
  // bytes 12-31: zeros (already zero from Uint8Array init)

  // Field descriptors (32 bytes each)
  for (let i = 0; i < w.frozenSchema.length; i++) {
    const field = w.frozenSchema[i];
    const base = 32 + 32 * i;

    // Bytes 0-10: field name, NUL-terminated, NUL-padded (bytes already zero)
    w.dbf.set(field.dbfNameBytes, base);
    // Byte 11: field type ASCII character
    w.dbf[base + 11] = field.type.charCodeAt(0);
    // Bytes 12-15: zeros (reserved)
    // Byte 16: field length in bytes
    w.dbf[base + 16] = field.length;
    // Byte 17: decimal count
    w.dbf[base + 17] = field.decimals;
    // Bytes 18-31: zeros
  }

  // Header terminator
  w.dbf[32 + 32 * numFields] = 0x0d;
}

export function writeDbfRecord(
  w: AssetWriter,
  props: Record<string, unknown>,
  simValues: Record<string, unknown>,
  encoder: TextEncoder,
): void {
  const base = w.dbfCursor;
  w.dbf[base] = 0x20; // deletion flag: 0x20 = not deleted

  for (let i = 0; i < w.frozenSchema.length; i++) {
    const field = w.frozenSchema[i];
    const absOffset = base + field.offsetInRecord;

    // Look up value: asset properties take precedence over sim values
    const propValue = props[field.originalKey];
    const value =
      propValue !== undefined ? propValue : simValues[field.originalKey];

    if (field.type === "L") {
      if (value === true) {
        w.dbf[absOffset] = 0x54; // 'T'
      } else if (value === false) {
        w.dbf[absOffset] = 0x46; // 'F'
      } else {
        w.dbf[absOffset] = 0x3f; // '?'
      }
    } else if (field.type === "N") {
      if (value === null || value === undefined || typeof value !== "number") {
        w.dbf.fill(0x20, absOffset, absOffset + field.length);
      } else {
        const formatted = value.toFixed(field.decimals);
        if (formatted.length > field.length) {
          // dBase overflow convention: fill with '*'
          w.dbf.fill(0x2a, absOffset, absOffset + field.length);
        } else {
          const padLen = field.length - formatted.length;
          w.dbf.fill(0x20, absOffset, absOffset + padLen);
          for (let j = 0; j < formatted.length; j++) {
            w.dbf[absOffset + padLen + j] = formatted.charCodeAt(j);
          }
        }
      }
    } else {
      // 'C' field
      if (value === null || value === undefined) {
        w.dbf.fill(0x20, absOffset, absOffset + field.length);
      } else {
        let str: string;
        if (typeof value === "string") {
          str = value;
        } else if (typeof value === "number") {
          str = value.toString();
        } else if (typeof value === "boolean") {
          str = value ? "true" : "false";
        } else {
          str = JSON.stringify(value);
        }
        const target = w.dbf.subarray(absOffset, absOffset + field.length);
        const { written } = encoder.encodeInto(str, target);
        if (written < field.length) {
          w.dbf.fill(0x20, absOffset + written, absOffset + field.length);
        }
      }
    }
  }

  w.dbfCursor += w.recordLength;
}
