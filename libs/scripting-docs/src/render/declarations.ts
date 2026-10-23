import type { Markdown, ScriptingDocs } from "../types";

export const renderDeclarations = (docs: ScriptingDocs): string => {
  const members = docs.sections.flatMap((section) => section.members ?? []);
  const types = docs.sections.flatMap((section) => section.types ?? []);
  return `${[
    GEOJSON,
    ...types.map(
      (type) =>
        `${docComment("", type.summary, type.description)}${type.definition.trim()}`,
    ),
    ...docs.interfaces.map((iface) => {
      const heritage = iface.extends ? ` extends ${iface.extends}` : "";
      const body = members
        .filter((member) => member.owner === iface.name)
        .map(
          (member) =>
            `${docComment("  ", member.summary, member.description)}  ${member.signature};`,
        );
      return `${docComment("", iface.summary)}interface ${iface.name}${heritage} {\n${body.join("\n")}\n}`;
    }),
    ...docs.globals.map(
      (global) =>
        `${docComment("", global.summary)}declare const ${global.name}: ${global.type};`,
    ),
  ].join("\n\n")}\n`;
};

const GEOJSON = `declare namespace GeoJSON {
  type Position = number[];
  interface Point { type: "Point"; coordinates: Position }
  interface LineString { type: "LineString"; coordinates: Position[] }
  interface Polygon { type: "Polygon"; coordinates: Position[][] }
  interface MultiPolygon { type: "MultiPolygon"; coordinates: Position[][][] }
  type Geometry = Point | LineString | Polygon | MultiPolygon;
  interface Feature<G extends Geometry = Geometry> {
    type: "Feature";
    geometry: G;
    properties: Record<string, unknown> | null;
    id?: string | number;
  }
}`;

const docComment = (
  indent: string,
  ...parts: (Markdown | undefined)[]
): string => {
  const lines = parts
    .filter((part): part is Markdown => !!part)
    .join("\n\n")
    .replace(/\*\//g, "*\\/")
    .split("\n");
  return `${indent}/**\n${lines.map((line) => `${indent} *${line ? ` ${line}` : ""}`).join("\n")}\n${indent} */\n`;
};
