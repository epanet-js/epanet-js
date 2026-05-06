import { buildSchema } from "./schema";
import { DBF_NUMBER_LENGTH, DBF_NUMBER_DECIMALS } from "./constants";

const encoder = new TextEncoder();

describe("buildSchema", () => {
  it("returns an empty array for an empty key set", () => {
    expect(buildSchema([], encoder)).toEqual([]);
  });

  it("skips keys not in PROPERTY_SCHEMA", () => {
    const fields = buildSchema(["unknownKey", "anotherUnknown"], encoder);
    expect(fields).toHaveLength(0);
  });

  it("maps a number property to an N field with fixed length and decimals", () => {
    const [field] = buildSchema(["elevation"], encoder);
    expect(field.type).toBe("N");
    expect(field.length).toBe(DBF_NUMBER_LENGTH);
    expect(field.decimals).toBe(DBF_NUMBER_DECIMALS);
    expect(field.dbfName).toBe("ELEVATION");
  });

  it("maps a boolean property to an L field with length 1 and decimals 0", () => {
    const [field] = buildSchema(["overflow"], encoder);
    expect(field.type).toBe("L");
    expect(field.length).toBe(1);
    expect(field.decimals).toBe(0);
    expect(field.dbfName).toBe("OVERFLOW");
  });

  it("maps a string property to a C field with fixed length and decimals 0", () => {
    const [field] = buildSchema(["label"], encoder);
    expect(field.type).toBe("C");
    expect(field.length).toBeGreaterThan(0);
    expect(field.decimals).toBe(0);
    expect(field.dbfName).toBe("LABEL");
  });

  it("preserves the original JS key in originalKey", () => {
    const [field] = buildSchema(["junctionConnection"], encoder);
    expect(field.originalKey).toBe("junctionConnection");
    expect(field.dbfName).toBe("JUNCCONN");
  });

  it("encodes dbfNameBytes as UTF-8 matching the dbfName", () => {
    const [field] = buildSchema(["pressure"], encoder);
    expect(field.dbfNameBytes).toEqual(encoder.encode("PRESSURE"));
  });

  it("assigns offsetInRecord starting at 1, accumulating field lengths", () => {
    const fields = buildSchema(["label", "elevation", "overflow"], encoder);
    expect(fields[0].offsetInRecord).toBe(1);
    expect(fields[1].offsetInRecord).toBe(1 + fields[0].length);
    expect(fields[2].offsetInRecord).toBe(1 + fields[0].length + fields[1].length);
  });

  it("uses the correct fixed DBF key for remapped properties", () => {
    const cases: [string, string][] = [
      ["bulkReactionCoeff", "BULKCOEFF"],
      ["wallReactionCoeff", "WALLCOEFF"],
      ["junctionConnection", "JUNCCONN"],
      ["pipeConnection", "PIPECONN"],
      ["connectionX", "CONNX"],
      ["connectionY", "CONNY"],
      ["positionX", "POSX"],
      ["positionY", "POSY"],
      ["startNode", "STARTNODE"],
      ["endNode", "ENDNODE"],
    ];
    for (const [key, expectedDbfKey] of cases) {
      const [field] = buildSchema([key], encoder);
      expect(field.dbfName).toBe(expectedDbfKey);
    }
  });
});
