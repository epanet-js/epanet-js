import { type AssetWriter } from "./asset-writer";

export function writeDbfHeader(w: AssetWriter): void {
  const now = new Date();
  const view = w.dbfView;
  const numFields = w.frozenSchema.length;

  view.setUint8(0, 0x03);
  view.setUint8(1, now.getFullYear() - 1900);
  view.setUint8(2, now.getMonth() + 1);
  view.setUint8(3, now.getDate());
  view.setUint32(4, w.recordCount, true);
  view.setUint16(8, 32 + 32 * numFields + 1, true);
  view.setUint16(10, w.recordLength, true);

  for (let i = 0; i < w.frozenSchema.length; i++) {
    const field = w.frozenSchema[i];
    const base = 32 + 32 * i;

    w.dbf.set(field.dbfNameBytes, base);
    w.dbf[base + 11] = field.type.charCodeAt(0);
    w.dbf[base + 16] = field.length;
    w.dbf[base + 17] = field.decimals;
  }

  w.dbf[32 + 32 * numFields] = 0x0d;
}

export function writeDbfRecord(
  w: AssetWriter,
  props: Record<string, unknown>,
  simValues: Record<string, unknown>,
  encoder: TextEncoder,
): void {
  const base = w.dbfCursor;
  w.dbf[base] = 0x20;

  for (let i = 0; i < w.frozenSchema.length; i++) {
    const field = w.frozenSchema[i];
    const absOffset = base + field.offsetInRecord;

    const propValue = props[field.originalKey];
    const value =
      propValue !== undefined ? propValue : simValues[field.originalKey];

    if (field.type === "L") {
      if (value === true) {
        w.dbf[absOffset] = 0x54;
      } else if (value === false) {
        w.dbf[absOffset] = 0x46;
      } else {
        w.dbf[absOffset] = 0x3f;
      }
    } else if (field.type === "N") {
      if (value === null || value === undefined || typeof value !== "number") {
        w.dbf.fill(0x20, absOffset, absOffset + field.length);
      } else {
        const formatted = value.toFixed(field.decimals);
        if (formatted.length > field.length) {
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
