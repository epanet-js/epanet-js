import { DBF_NUMBER_LENGTH, DBF_NUMBER_DECIMALS } from "./constants";

export type Field = {
  originalKey: string;
  dbfName: string;
  dbfNameBytes: Uint8Array;
  type: "C" | "N" | "L";
  length: number;
  decimals: number;
  offsetInRecord: number;
};

type PropertyDef =
  | { dbfKey: string; type: "N" | "L" }
  | { dbfKey: string; type: "C"; length: number };

const PROPERTY_SCHEMA: Record<string, PropertyDef> = {
  diameter: { dbfKey: "DIAMETER", type: "N" },
  roughness: { dbfKey: "ROUGHNESS", type: "N" },
  minorLoss: { dbfKey: "MINORLOSS", type: "N" },
  initialStatus: { dbfKey: "INITSTATUS", type: "C", length: 20 },
  bulkReactionCoeff: { dbfKey: "BULKCOEFF", type: "N" },
  wallReactionCoeff: { dbfKey: "WALLCOEFF", type: "N" },
  length: { dbfKey: "LENGTH", type: "N" },
  flow: { dbfKey: "FLOW", type: "N" },
  velocity: { dbfKey: "VELOCITY", type: "N" },
  elevation: { dbfKey: "ELEVATION", type: "N" },
  initialQuality: { dbfKey: "INITQUAL", type: "N" },
  chemicalSourceType: { dbfKey: "SRCTYPE", type: "C", length: 20 },
  chemicalSourceStrength: { dbfKey: "SRCSTRENGT", type: "N" },
  emitterCoefficient: { dbfKey: "EMITTER", type: "N" },
  definitionType: { dbfKey: "DEFTYPE", type: "C", length: 20 },
  power: { dbfKey: "POWER", type: "N" },
  speed: { dbfKey: "SPEED", type: "N" },
  energyPrice: { dbfKey: "ENERGYCOST", type: "N" },
  head: { dbfKey: "HEAD", type: "N" },
  initialLevel: { dbfKey: "INITLEVEL", type: "N" },
  minLevel: { dbfKey: "MINLEVEL", type: "N" },
  maxLevel: { dbfKey: "MAXLEVEL", type: "N" },
  minVolume: { dbfKey: "MINVOLUME", type: "N" },
  overflow: { dbfKey: "OVERFLOW", type: "L" },
  mixingModel: { dbfKey: "MIXMODEL", type: "C", length: 20 },
  mixingFraction: { dbfKey: "MIXFRAC", type: "N" },
  pressure: { dbfKey: "PRESSURE", type: "N" },
  kind: { dbfKey: "KIND", type: "C", length: 20 },
  setting: { dbfKey: "SETTING", type: "N" },
  label: { dbfKey: "LABEL", type: "C", length: 50 },
  isActive: { dbfKey: "ISACTIVE", type: "L" },
  junctionConnection: { dbfKey: "JUNCCONN", type: "C", length: 50 },
  pipeConnection: { dbfKey: "PIPECONN", type: "C", length: 50 },
  connectionX: { dbfKey: "CONNX", type: "N" },
  connectionY: { dbfKey: "CONNY", type: "N" },
  positionX: { dbfKey: "POSX", type: "N" },
  positionY: { dbfKey: "POSY", type: "N" },
  startNode: { dbfKey: "STARTNODE", type: "C", length: 50 },
  endNode: { dbfKey: "ENDNODE", type: "C", length: 50 },
};

export function buildSchema(
  keys: Iterable<string>,
  encoder: TextEncoder,
): Field[] {
  const fields: Field[] = [];
  let offset = 1;

  for (const key of keys) {
    const def = PROPERTY_SCHEMA[key];
    if (!def) continue;

    const length =
      def.type === "N" ? DBF_NUMBER_LENGTH : def.type === "L" ? 1 : def.length;
    const decimals = def.type === "N" ? DBF_NUMBER_DECIMALS : 0;

    fields.push({
      originalKey: key,
      dbfName: def.dbfKey,
      dbfNameBytes: encoder.encode(def.dbfKey),
      type: def.type,
      length,
      decimals,
      offsetInRecord: offset,
    });

    offset += length;
  }

  return fields;
}
