const NON_ASCII = /[^\x00-\x7f]/;
const INVALID_DBF_NAME_CHAR = /[^A-Z0-9_]/g;

export type FieldInfo = {
  originalKey: string;
  dbfType: "C" | "N" | "L" | null;
  maxLength: number;
  maxDecimals: number;
  hasNonAscii: boolean;
  promotedToString: boolean;
};

export type Field = {
  originalKey: string;
  dbfName: string;
  dbfNameBytes: Uint8Array;
  type: "C" | "N" | "L";
  length: number;
  decimals: number;
  offsetInRecord: number;
};

function measureStringBytes(
  str: string,
  scratch: Uint8Array,
  encoder: TextEncoder,
): number {
  if (NON_ASCII.test(str)) {
    if (str.length * 4 > scratch.length) {
      return encoder.encode(str).length;
    }
    const { written } = encoder.encodeInto(str, scratch);
    return written;
  }
  return str.length;
}

export function ensureField(
  fields: Map<string, FieldInfo>,
  key: string,
): FieldInfo {
  let info = fields.get(key);
  if (!info) {
    info = {
      originalKey: key,
      dbfType: null,
      maxLength: 0,
      maxDecimals: 0,
      hasNonAscii: false,
      promotedToString: false,
    };
    fields.set(key, info);
  }
  return info;
}

export function inferFieldType(
  info: FieldInfo,
  value: unknown,
  scratch: Uint8Array,
  encoder: TextEncoder,
): void {
  if (value === null || value === undefined) {
    return;
  }

  if (typeof value === "boolean") {
    if (info.dbfType === null) {
      info.dbfType = "L";
      info.maxLength = 1;
    } else if (info.dbfType === "N" || info.dbfType === "C") {
      info.dbfType = "C";
      info.promotedToString = true;
      if (5 > info.maxLength) info.maxLength = 5; // "false"
    }
    return;
  }

  if (typeof value === "number") {
    const s = value.toString();
    const dotIdx = s.indexOf(".");
    const decimals = dotIdx === -1 ? 0 : s.length - dotIdx - 1;
    const len = s.length;

    if (info.dbfType === null) {
      info.dbfType = "N";
      info.maxLength = len;
      info.maxDecimals = decimals;
    } else if (info.dbfType === "N") {
      if (len > info.maxLength) info.maxLength = len;
      if (decimals > info.maxDecimals) info.maxDecimals = decimals;
    } else {
      // 'L' or 'C' → promote to 'C'
      info.dbfType = "C";
      info.promotedToString = true;
      const byteLen = measureStringBytes(s, scratch, encoder);
      if (byteLen > info.maxLength) info.maxLength = byteLen;
    }
    return;
  }

  if (typeof value === "string") {
    const byteLen = measureStringBytes(value, scratch, encoder);

    if (info.dbfType === null) {
      info.dbfType = "C";
      info.maxLength = byteLen;
      if (NON_ASCII.test(value)) info.hasNonAscii = true;
    } else if (info.dbfType === "C") {
      if (byteLen > info.maxLength) info.maxLength = byteLen;
      if (NON_ASCII.test(value)) info.hasNonAscii = true;
    } else {
      // 'N' or 'L' → promote to 'C'
      info.dbfType = "C";
      info.promotedToString = true;
      if (byteLen > info.maxLength) info.maxLength = byteLen;
      if (NON_ASCII.test(value)) info.hasNonAscii = true;
    }
    return;
  }

  // Anything else: JSON.stringify, treat as string
  const s = JSON.stringify(value);
  const byteLen = measureStringBytes(s, scratch, encoder);
  if (info.dbfType === null) {
    info.dbfType = "C";
    info.maxLength = byteLen;
  } else if (info.dbfType === "C") {
    if (byteLen > info.maxLength) info.maxLength = byteLen;
  } else {
    info.dbfType = "C";
    info.promotedToString = true;
    if (byteLen > info.maxLength) info.maxLength = byteLen;
  }
}

function sanitizeName(key: string): string {
  const upper = key.toUpperCase().replace(INVALID_DBF_NAME_CHAR, "_");
  if (upper.length <= 10) return upper;
  return upper.slice(0, 10);
}

function deduplicateName(base: string, usedNames: Set<string>): string {
  if (!usedNames.has(base)) return base;
  let counter = 1;
  for (;;) {
    const suffix = String(counter);
    const truncatedBase = base.slice(0, 10 - suffix.length);
    const candidate = truncatedBase + suffix;
    if (!usedNames.has(candidate)) return candidate;
    counter++;
  }
}

export function freezeSchema(
  fields: Map<string, FieldInfo>,
  encoder: TextEncoder,
): Field[] {
  const frozen: Field[] = [];
  const usedNames = new Set<string>();
  let offset = 1; // start at 1 to skip the deletion flag byte

  for (const [, info] of fields) {
    const sanitized = sanitizeName(info.originalKey);
    const dbfName = deduplicateName(sanitized, usedNames);
    usedNames.add(dbfName);

    let type: "C" | "N" | "L";
    let length: number;
    let decimals: number;

    if (info.dbfType === "L") {
      type = "L";
      length = 1;
      decimals = 0;
    } else if (info.dbfType === "N") {
      type = "N";
      length = Math.min(info.maxLength, 19);
      decimals = info.maxDecimals;
      // Cap decimals so integer part + dot + decimals fits within length
      if (decimals > 0 && decimals >= length - 1) {
        decimals = Math.max(0, length - 2);
      }
    } else {
      // 'C' or null (only nulls seen)
      type = "C";
      length = info.dbfType === null ? 1 : Math.max(1, Math.min(info.maxLength, 254));
      decimals = 0;
    }

    const nameStr = dbfName.slice(0, 10);
    const dbfNameBytes = encoder.encode(nameStr);

    frozen.push({
      originalKey: info.originalKey,
      dbfName,
      dbfNameBytes,
      type,
      length,
      decimals,
      offsetInRecord: offset,
    });

    offset += length;
  }

  return frozen;
}
