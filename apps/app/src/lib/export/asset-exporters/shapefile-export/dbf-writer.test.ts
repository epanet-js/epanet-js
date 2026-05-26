import { AssetWriter } from "./asset-writer";
import { type Field } from "./schema";
import { writeDbfHeader, writeDbfRecord } from "./dbf-writer";
import { DBF_NUMBER_LENGTH, DBF_NUMBER_DECIMALS } from "./constants";

const encoder = new TextEncoder();

// Resolved field length for N is always DBF_NUMBER_LENGTH
const N_LEN = DBF_NUMBER_LENGTH;
const N_DEC = DBF_NUMBER_DECIMALS;

type FieldDef = {
  key: string;
  type: "C" | "N" | "L";
  length: number;
};

function makeFields(fieldDefs: FieldDef[]): Field[] {
  let offset = 1;
  return fieldDefs.map((f) => {
    const length =
      f.type === "N" ? DBF_NUMBER_LENGTH : f.type === "L" ? 1 : f.length;
    const decimals = f.type === "N" ? DBF_NUMBER_DECIMALS : 0;
    const dbfName = f.key.toUpperCase().slice(0, 10);
    const field: Field = {
      originalKey: f.key,
      dbfName,
      dbfNameBytes: encoder.encode(dbfName),
      type: f.type,
      length,
      decimals,
      offsetInRecord: offset,
    };
    offset += length;
    return field;
  });
}

function makeWriter(fieldDefs: FieldDef[], recordCount = 1) {
  const w = new AssetWriter(1);
  w.frozenSchema = makeFields(fieldDefs);
  w.recordCount = recordCount;
  w.shpBodyBytes = 28 * recordCount;
  w.allocate();
  writeDbfHeader(w);
  return w;
}

describe("writeDbfHeader", () => {
  it("writes dBase III marker (0x03) at byte 0", () => {
    const w = makeWriter([]);
    expect(w.dbf[0]).toBe(0x03);
  });

  it("writes current year (offset from 1900) at byte 1", () => {
    const w = makeWriter([]);
    expect(w.dbf[1]).toBe(new Date().getFullYear() - 1900);
  });

  it("writes record count at bytes 4-7 (little-endian)", () => {
    const w = makeWriter([], 5);
    expect(w.dbfView.getUint32(4, true)).toBe(5);
  });

  it("writes header length at bytes 8-9 (little-endian)", () => {
    const w = makeWriter([{ key: "x", type: "C", length: 5 }]);
    const numFields = 1;
    expect(w.dbfView.getUint16(8, true)).toBe(32 + 32 * numFields + 1);
  });

  it("writes record length at bytes 10-11 (little-endian)", () => {
    const w = makeWriter([{ key: "x", type: "C", length: 5 }]);
    expect(w.dbfView.getUint16(10, true)).toBe(w.recordLength);
  });

  it("writes field type as ASCII at byte 11 of each field descriptor", () => {
    const w = makeWriter([
      { key: "label", type: "C", length: 10 },
      { key: "count", type: "N", length: 5 },
      { key: "active", type: "L", length: 1 },
    ]);
    expect(w.dbf[32 + 11]).toBe("C".charCodeAt(0));
    expect(w.dbf[64 + 11]).toBe("N".charCodeAt(0));
    expect(w.dbf[96 + 11]).toBe("L".charCodeAt(0));
  });

  it("writes field length at byte 16 of each C field descriptor", () => {
    const w = makeWriter([{ key: "name", type: "C", length: 12 }]);
    expect(w.dbf[32 + 16]).toBe(12);
  });

  it("writes fixed DBF_NUMBER_LENGTH at byte 16 for N fields", () => {
    const w = makeWriter([{ key: "val", type: "N", length: 5 }]);
    expect(w.dbf[32 + 16]).toBe(N_LEN);
  });

  it("writes fixed DBF_NUMBER_DECIMALS at byte 17 for N fields", () => {
    const w = makeWriter([{ key: "val", type: "N", length: 5 }]);
    expect(w.dbf[32 + 17]).toBe(N_DEC);
  });

  it("writes header terminator 0x0D after field descriptors", () => {
    const numFields = 2;
    const w = makeWriter([
      { key: "a", type: "C", length: 5 },
      { key: "b", type: "N", length: 4 },
    ]);
    const terminatorOffset = 32 + 32 * numFields;
    expect(w.dbf[terminatorOffset]).toBe(0x0d);
  });

  it("writes field names into the descriptor (first bytes)", () => {
    const w = makeWriter([{ key: "myfield", type: "C", length: 5 }]);
    const nameBytes = Array.from(encoder.encode("MYFIELD"));
    const actual = Array.from(w.dbf.slice(32, 32 + nameBytes.length));
    expect(actual).toEqual(nameBytes);
  });
});

describe("writeDbfRecord", () => {
  it("writes deletion flag 0x20 (space) at start of record", () => {
    const w = makeWriter([{ key: "x", type: "C", length: 5 }]);
    writeDbfRecord(w, { x: "hello" }, {}, encoder);
    const recStart = w.dbfCursor - w.recordLength;
    expect(w.dbf[recStart]).toBe(0x20);
  });

  it("L field: writes 'T' for true", () => {
    const w = makeWriter([{ key: "active", type: "L", length: 1 }]);
    const recStart = w.dbfCursor;
    writeDbfRecord(w, { active: true }, {}, encoder);
    expect(w.dbf[recStart + 1]).toBe(0x54); // 'T'
  });

  it("L field: writes 'F' for false", () => {
    const w = makeWriter([{ key: "active", type: "L", length: 1 }]);
    const recStart = w.dbfCursor;
    writeDbfRecord(w, { active: false }, {}, encoder);
    expect(w.dbf[recStart + 1]).toBe(0x46); // 'F'
  });

  it("L field: writes '?' for null", () => {
    const w = makeWriter([{ key: "active", type: "L", length: 1 }]);
    const recStart = w.dbfCursor;
    writeDbfRecord(w, { active: null }, {}, encoder);
    expect(w.dbf[recStart + 1]).toBe(0x3f); // '?'
  });

  it("N field: right-aligns number with DBF_NUMBER_DECIMALS decimal places", () => {
    const w = makeWriter([{ key: "val", type: "N", length: 5 }]);
    const recStart = w.dbfCursor;
    writeDbfRecord(w, { val: 3.14 }, {}, encoder);
    const field = w.dbf.slice(recStart + 1, recStart + 1 + N_LEN);
    const str = new TextDecoder().decode(field);
    const expected = (3.14).toFixed(N_DEC).padStart(N_LEN);
    expect(str).toBe(expected);
  });

  it("N field: fills entire field with spaces for null", () => {
    const w = makeWriter([{ key: "val", type: "N", length: 5 }]);
    const recStart = w.dbfCursor;
    writeDbfRecord(w, { val: null }, {}, encoder);
    const field = w.dbf.slice(recStart + 1, recStart + 1 + N_LEN);
    expect(Array.from(field).every((b) => b === 0x20)).toBe(true);
  });

  it("N field: fills with '*' when formatted number overflows field width", () => {
    const w = makeWriter([{ key: "v", type: "N", length: 5 }]);
    const recStart = w.dbfCursor;
    // 1e20.toFixed(DBF_NUMBER_DECIMALS) exceeds DBF_NUMBER_LENGTH characters
    writeDbfRecord(w, { v: 1e20 }, {}, encoder);
    const field = w.dbf.slice(recStart + 1, recStart + 1 + N_LEN);
    expect(Array.from(field).every((b) => b === 0x2a)).toBe(true); // '*'
  });

  it("C field: writes string padded with spaces on right", () => {
    const w = makeWriter([{ key: "name", type: "C", length: 10 }]);
    const recStart = w.dbfCursor;
    writeDbfRecord(w, { name: "hello" }, {}, encoder);
    const field = new TextDecoder().decode(
      w.dbf.slice(recStart + 1, recStart + 11),
    );
    expect(field).toBe("hello     ");
  });

  it("C field: fills with spaces for null", () => {
    const w = makeWriter([{ key: "name", type: "C", length: 5 }]);
    const recStart = w.dbfCursor;
    writeDbfRecord(w, { name: null }, {}, encoder);
    const field = w.dbf.slice(recStart + 1, recStart + 6);
    expect(Array.from(field).every((b) => b === 0x20)).toBe(true);
  });

  it("falls back to simValues when prop key is absent", () => {
    const w = makeWriter([{ key: "pressure", type: "N", length: 6 }]);
    const recStart = w.dbfCursor;
    writeDbfRecord(w, {}, { pressure: 12.5 }, encoder);
    const field = new TextDecoder().decode(
      w.dbf.slice(recStart + 1, recStart + 1 + N_LEN),
    );
    expect(field.trim()).toBe((12.5).toFixed(N_DEC));
  });

  it("props take precedence over simValues for same key", () => {
    const w = makeWriter([{ key: "pressure", type: "N", length: 6 }]);
    const recStart = w.dbfCursor;
    writeDbfRecord(w, { pressure: 5.0 }, { pressure: 99.0 }, encoder);
    const field = new TextDecoder().decode(
      w.dbf.slice(recStart + 1, recStart + 1 + N_LEN),
    );
    expect(field.trim()).toBe((5.0).toFixed(N_DEC));
  });

  it("advances dbfCursor by recordLength", () => {
    const w = makeWriter([{ key: "x", type: "C", length: 5 }]);
    const before = w.dbfCursor;
    writeDbfRecord(w, { x: "ab" }, {}, encoder);
    expect(w.dbfCursor).toBe(before + w.recordLength);
  });
});
