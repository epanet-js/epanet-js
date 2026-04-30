import { ensureField, freezeSchema, inferFieldType } from "./schema";

const encoder = new TextEncoder();
const scratch = new Uint8Array(1024);

describe("inferFieldType", () => {
  it("null/undefined: ensures field exists, leaves dbfType null", () => {
    const fields = new Map();
    const info = ensureField(fields, "x");
    inferFieldType(info, null, scratch, encoder);
    inferFieldType(info, undefined, scratch, encoder);
    expect(info.dbfType).toBeNull();
  });

  it("boolean: sets L type with length 1", () => {
    const fields = new Map();
    const info = ensureField(fields, "x");
    inferFieldType(info, true, scratch, encoder);
    expect(info.dbfType).toBe("L");
    expect(info.maxLength).toBe(1);
  });

  it("number: sets N type with length and decimals", () => {
    const fields = new Map();
    const info = ensureField(fields, "x");
    inferFieldType(info, 3.14, scratch, encoder);
    expect(info.dbfType).toBe("N");
    expect(info.maxLength).toBe(4); // "3.14"
    expect(info.maxDecimals).toBe(2);
  });

  it("integer number: decimals = 0", () => {
    const fields = new Map();
    const info = ensureField(fields, "x");
    inferFieldType(info, 42, scratch, encoder);
    expect(info.dbfType).toBe("N");
    expect(info.maxDecimals).toBe(0);
  });

  it("string: sets C type with byte length", () => {
    const fields = new Map();
    const info = ensureField(fields, "x");
    inferFieldType(info, "hello", scratch, encoder);
    expect(info.dbfType).toBe("C");
    expect(info.maxLength).toBe(5);
  });

  it("object: JSON.stringify, treated as C type", () => {
    const fields = new Map();
    const info = ensureField(fields, "x");
    inferFieldType(info, { a: 1 }, scratch, encoder);
    expect(info.dbfType).toBe("C");
    expect(info.maxLength).toBe(JSON.stringify({ a: 1 }).length);
  });

  it("type promotion: number then string → C, max of both lengths", () => {
    const fields = new Map();
    const info = ensureField(fields, "x");
    inferFieldType(info, 42, scratch, encoder);
    inferFieldType(info, "longstring", scratch, encoder);
    expect(info.dbfType).toBe("C");
    expect(info.maxLength).toBe(10); // "longstring"
    expect(info.promotedToString).toBe(true);
  });

  it("type promotion: boolean then number → C", () => {
    const fields = new Map();
    const info = ensureField(fields, "x");
    inferFieldType(info, true, scratch, encoder);
    inferFieldType(info, 42, scratch, encoder);
    expect(info.dbfType).toBe("C");
  });

  it("N: tracks maxLength and maxDecimals across multiple values", () => {
    const fields = new Map();
    const info = ensureField(fields, "x");
    inferFieldType(info, 1.5, scratch, encoder);
    inferFieldType(info, 100.123, scratch, encoder);
    inferFieldType(info, -9.9, scratch, encoder);
    expect(info.maxLength).toBe(7); // "100.123"
    expect(info.maxDecimals).toBe(3);
  });

  it("non-ASCII string: measures byte length", () => {
    const fields = new Map();
    const info = ensureField(fields, "x");
    inferFieldType(info, "héllo", scratch, encoder); // 'é' is 2 bytes in UTF-8
    expect(info.dbfType).toBe("C");
    expect(info.maxLength).toBe(6); // 5 chars but 6 UTF-8 bytes
    expect(info.hasNonAscii).toBe(true);
  });
});

describe("freezeSchema", () => {
  it("L type: length=1, decimals=0", () => {
    const fields = new Map();
    const info = ensureField(fields, "active");
    info.dbfType = "L";
    info.maxLength = 1;

    const schema = freezeSchema(fields, encoder);
    expect(schema[0].type).toBe("L");
    expect(schema[0].length).toBe(1);
    expect(schema[0].decimals).toBe(0);
  });

  it("N type: capped at 19 chars", () => {
    const fields = new Map();
    const info = ensureField(fields, "val");
    info.dbfType = "N";
    info.maxLength = 25;
    info.maxDecimals = 2;

    const schema = freezeSchema(fields, encoder);
    expect(schema[0].length).toBe(19);
  });

  it("C type: capped at 254", () => {
    const fields = new Map();
    const info = ensureField(fields, "text");
    info.dbfType = "C";
    info.maxLength = 300;

    const schema = freezeSchema(fields, encoder);
    expect(schema[0].length).toBe(254);
  });

  it("null dbfType (only nulls): C with length 1", () => {
    const fields = new Map();
    ensureField(fields, "x");

    const schema = freezeSchema(fields, encoder);
    expect(schema[0].type).toBe("C");
    expect(schema[0].length).toBe(1);
  });

  it("sanitizes field name: uppercase and replaces non-alphanumeric", () => {
    const fields = new Map();
    ensureField(fields, "pipe-length (m)").dbfType = "N";

    const schema = freezeSchema(fields, encoder);
    expect(schema[0].dbfName).toBe("PIPE_LENGT");
  });

  it("truncates name to 10 chars", () => {
    const fields = new Map();
    ensureField(fields, "averylongerpropertyname").dbfType = "C";
    ensureField(fields, "averylongerpropertyname").maxLength = 5;

    const schema = freezeSchema(fields, encoder);
    expect(schema[0].dbfName.length).toBeLessThanOrEqual(10);
  });

  it("resolves collisions with numeric suffix", () => {
    const fields = new Map();
    // Both truncate to "ABCDEFGHIJ" (10 chars)
    const a = ensureField(fields, "abcdefghij");
    a.dbfType = "C";
    a.maxLength = 3;
    const b = ensureField(fields, "abcdefghijXX");
    b.dbfType = "C";
    b.maxLength = 3;

    const schema = freezeSchema(fields, encoder);
    expect(schema[0].dbfName).toBe("ABCDEFGHIJ");
    expect(schema[1].dbfName).toBe("ABCDEFGHI1");
    expect(schema[1].dbfName.length).toBeLessThanOrEqual(10);
  });

  it("computes offsetInRecord starting at 1 (after deletion flag)", () => {
    const fields = new Map();
    const a = ensureField(fields, "a");
    a.dbfType = "C";
    a.maxLength = 5;
    const b = ensureField(fields, "b");
    b.dbfType = "C";
    b.maxLength = 3;

    const schema = freezeSchema(fields, encoder);
    expect(schema[0].offsetInRecord).toBe(1);
    expect(schema[1].offsetInRecord).toBe(6); // 1 + 5
  });

  it("dbfNameBytes is pre-encoded and ≤10 bytes", () => {
    const fields = new Map();
    ensureField(fields, "label").dbfType = "C";

    const schema = freezeSchema(fields, encoder);
    expect(schema[0].dbfNameBytes).toBeInstanceOf(Uint8Array);
    expect(schema[0].dbfNameBytes.length).toBeLessThanOrEqual(10);
  });
});
