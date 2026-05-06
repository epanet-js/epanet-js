import { DBF_NUMBER_LENGTH, DBF_NUMBER_DECIMALS } from "./constants";

const NON_ASCII = /[^\x00-\x7f]/;
const INVALID_DBF_NAME_CHAR = /[^A-Z0-9_]/g;

const PROPERTY_DBF_MAP: Record<string, string> = {
  diameter: "DIAMETER",
  roughness: "ROUGHNESS",
  minorLoss: "MINORLOSS",
  initialStatus: "INITSTATUS",
  bulkReactionCoeff: "BULKCOEFF",
  wallReactionCoeff: "WALLCOEFF",
  length: "LENGTH",
  flow: "FLOW",
  velocity: "VELOCITY",
  elevation: "ELEVATION",
  initialQuality: "INITQUAL",
  chemicalSourceType: "SRCTYPE",
  chemicalSourceStrength: "SRCSTRENGT",
  emitterCoefficient: "EMITTER",
  definitionType: "DEFTYPE",
  power: "POWER",
  speed: "SPEED",
  energyPrice: "ENERGYCOST",
  head: "HEAD",
  initialLevel: "INITLEVEL",
  minLevel: "MINLEVEL",
  maxLevel: "MAXLEVEL",
  minVolume: "MINVOLUME",
  overflow: "OVERFLOW",
  mixingModel: "MIXMODEL",
  mixingFraction: "MIXFRAC",
  pressure: "PRESSURE",
  kind: "KIND",
  setting: "SETTING",
  label: "LABEL",
  isActive: "ISACTIVE",
  junctionConnection: "JUNCCONN",
  pipeConnection: "PIPECONN",
  connectionX: "CONNX",
  connectionY: "CONNY",
  positionX: "POSX",
  positionY: "POSY",
  startNode: "STARTNODE",
  endNode: "ENDNODE",
};

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
    } else if (info.dbfType === "N") {
      info.dbfType = "C";
      info.promotedToString = true;
      info.maxLength = DBF_NUMBER_LENGTH;
    } else if (info.dbfType === "C") {
      info.promotedToString = true;
      if (5 > info.maxLength) info.maxLength = 5;
    }
    return;
  }

  if (typeof value === "number") {
    if (info.dbfType === null) {
      info.dbfType = "N";
    } else if (info.dbfType === "N") {
    } else {
      const s = value.toString();
      const byteLen = measureStringBytes(s, scratch, encoder);
      info.dbfType = "C";
      info.promotedToString = true;
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
    } else if (info.dbfType === "N") {
      info.dbfType = "C";
      info.promotedToString = true;
      info.maxLength = Math.max(DBF_NUMBER_LENGTH, byteLen);
      if (NON_ASCII.test(value)) info.hasNonAscii = true;
    } else {
      info.dbfType = "C";
      info.promotedToString = true;
      if (byteLen > info.maxLength) info.maxLength = byteLen;
      if (NON_ASCII.test(value)) info.hasNonAscii = true;
    }
    return;
  }

  const s = JSON.stringify(value);
  const byteLen = measureStringBytes(s, scratch, encoder);
  if (info.dbfType === null) {
    info.dbfType = "C";
    info.maxLength = byteLen;
  } else if (info.dbfType === "C") {
    if (byteLen > info.maxLength) info.maxLength = byteLen;
  } else if (info.dbfType === "N") {
    info.dbfType = "C";
    info.promotedToString = true;
    info.maxLength = Math.max(DBF_NUMBER_LENGTH, byteLen);
  } else {
    info.dbfType = "C";
    info.promotedToString = true;
    if (byteLen > info.maxLength) info.maxLength = byteLen;
  }
}

export function freezeSchema(
  fields: Map<string, FieldInfo>,
  encoder: TextEncoder,
): Field[] {
  const frozen: Field[] = [];
  const usedNames = new Set<string>();
  let offset = 1;

  for (const [, info] of fields) {
    const fixed = PROPERTY_DBF_MAP[info.originalKey];
    const dbfName = fixed ?? deduplicateName(sanitizeName(info.originalKey), usedNames);
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
      length = DBF_NUMBER_LENGTH;
      decimals = DBF_NUMBER_DECIMALS;
    } else {
      type = "C";
      length =
        info.dbfType === null ? 1 : Math.max(1, Math.min(info.maxLength, 254));
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
