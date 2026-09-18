// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- reaches consumers that compile this file with their own tsconfig
/// <reference path="./dxf.d.ts" />
import type { Feature, Geometry, Position } from "geojson";
import { parseString, type DxfBlock, type DxfEntity } from "dxf";
import entityToPolyline from "dxf/lib/entityToPolyline";

export type DxfBounds = [number, number, number, number];

export type DxfStatedCrs = {
  epsg?: number;
  wkt?: string;
  bounds?: DxfBounds;
};

export type ParsedDxf = { features: Feature[]; stated?: DxfStatedCrs };

export const readDxf = (bytes: ArrayBuffer): ParsedDxf | null => {
  const content = decodeDxf(bytes);
  if (content === null) return null;

  const document = parseDocument(content);
  if (document === null) return null;

  const scale = unitScaleOf(document.header.insUnits);
  const features: Feature[] = [];
  collect(document.entities, {
    blocks: new Map(document.blocks.map((block) => [block.name, block])),
    matrix: IDENTITY,
    layer: DEFAULT_LAYER,
    expanding: new Set<string>(),
    scale,
    features,
  });

  const stated = statedCrsOf(content, scale);

  return { features, ...(stated === undefined ? {} : { stated }) };
};

const parseDocument = (content: string) => {
  try {
    return parseString(content);
  } catch {
    return null;
  }
};

const BINARY_SENTINEL = "AutoCAD Binary DXF";
const HEADER_BYTES = 4096;
const UTF8_FROM_VERSION = "AC1021";
const DEFAULT_CODE_PAGE = "windows-1252";

const codePages: Record<string, string> = {
  "932": "shift_jis",
  "936": "gbk",
  "949": "euc-kr",
  "950": "big5",
};

const decodeDxf = (bytes: ArrayBuffer): string | null => {
  const head = new TextDecoder("latin1").decode(
    new Uint8Array(bytes, 0, Math.min(bytes.byteLength, HEADER_BYTES)),
  );
  if (head.startsWith(BINARY_SENTINEL)) return null;

  return decodeWith(bytes, encodingOf(head));
};

const decodeWith = (bytes: ArrayBuffer, encoding: string): string => {
  try {
    return new TextDecoder(encoding).decode(bytes);
  } catch {
    return new TextDecoder(DEFAULT_CODE_PAGE).decode(bytes);
  }
};

const encodingOf = (head: string): string => {
  const version = headerValue(head, "ACADVER");
  if (version !== null && version >= UTF8_FROM_VERSION) return "utf-8";

  const codePage = (headerValue(head, "DWGCODEPAGE") ?? "").replace(
    /^ANSI_/i,
    "",
  );
  if (codePages[codePage]) return codePages[codePage];

  return /^\d+$/.test(codePage) ? `windows-${codePage}` : DEFAULT_CODE_PAGE;
};

const headerValue = (head: string, name: string): string | null => {
  const match = new RegExp(`\\$${name}\\s*\\r?\\n\\s*\\d+\\s*\\r?\\n(.*)`).exec(
    head,
  );
  return match === null ? null : match[1].trim();
};

const unitScales: Record<number, number> = { 4: 0.001, 5: 0.01, 14: 0.1 };

const unitScaleOf = (insUnits: number | undefined): number =>
  insUnits === undefined ? 1 : (unitScales[insUnits] ?? 1);

const unicodeEscape = /\\U\+([0-9A-Fa-f]{4})/g;

const decodeEscapes = (value: string): string =>
  value.replace(unicodeEscape, (_, code: string) =>
    String.fromCharCode(parseInt(code, 16)),
  );

const GEODATA = "GEODATA";
const GEODATA_VERSIONS = new Set([2, 3]);
const PLACED_COORDINATE_TYPES = new Set([2, 3]);

const VERSION_CODE = 90;
const COORDINATE_TYPE_CODE = 70;
const DEFINITION_CODES = new Set([301, 303]);
const MESH_X_CODE = 13;
const MESH_Y_CODE = 23;

type Pair = [number, string];

const statedCrsOf = (
  content: string,
  scale: number,
): DxfStatedCrs | undefined => {
  if (!content.includes(GEODATA)) return undefined;

  const fields = geoDataFields(content);
  if (fields === null) return undefined;

  const version = numberField(fields, VERSION_CODE);
  const coordinateType = numberField(fields, COORDINATE_TYPE_CODE);
  if (version === null || !GEODATA_VERSIONS.has(version)) return undefined;
  if (coordinateType === null || !PLACED_COORDINATE_TYPES.has(coordinateType)) {
    return undefined;
  }

  const definition = definitionOf(
    fields
      .filter(([code]) => DEFINITION_CODES.has(code))
      .map(([, value]) => value)
      .join(""),
  );
  if (definition === undefined) return undefined;

  const bounds = meshBounds(fields, scale);

  return { ...definition, ...(bounds === undefined ? {} : { bounds }) };
};

const geoDataFields = (content: string): Pair[] | null => {
  const pairs = pairsOf(content);
  const start = pairs.findIndex(
    ([code, value]) => code === 0 && value === GEODATA,
  );
  if (start === -1) return null;

  const fields: Pair[] = [];
  for (let index = start + 1; index < pairs.length; index++) {
    if (pairs[index][0] === 0) break;
    fields.push(pairs[index]);
  }

  return fields;
};

const pairsOf = (content: string): Pair[] => {
  const lines = content.split("\n");
  const pairs: Pair[] = [];

  for (let index = 0; index + 1 < lines.length; index += 2) {
    pairs.push([Number(lines[index].trim()), lines[index + 1].trim()]);
  }

  return pairs;
};

const numberField = (fields: Pair[], code: number): number | null => {
  const field = fields.find(([its]) => its === code);
  return field === undefined ? null : Number(field[1]);
};

const definitionOf = (
  definition: string,
): { epsg?: number; wkt?: string } | undefined => {
  const text = definition.trim();
  if (text === "") return undefined;
  if (!text.startsWith("<")) return { wkt: text };

  const epsg = epsgFromCoordinateSystemXml(text);
  return epsg === null ? {} : { epsg };
};

const ALIAS = /<Alias\s+([^>]*)>([\s\S]*?)<\/Alias>/g;

const epsgFromCoordinateSystemXml = (xml: string): number | null => {
  ALIAS.lastIndex = 0;
  let alias: RegExpExecArray | null;

  while ((alias = ALIAS.exec(xml)) !== null) {
    const [, attributes, body] = alias;
    if (!/type="CoordinateSystem"/i.test(attributes)) continue;
    if (!/EPSG/i.test(body)) continue;

    const id = /id="(\d+)"/i.exec(attributes)?.[1];
    if (id !== undefined) return Number(id);
  }

  return null;
};

const meshBounds = (fields: Pair[], scale: number): DxfBounds | undefined => {
  const xs = coordinates(fields, MESH_X_CODE);
  const ys = coordinates(fields, MESH_Y_CODE);
  if (xs.length === 0 || ys.length === 0) return undefined;

  return [
    Math.min(...xs) * scale,
    Math.min(...ys) * scale,
    Math.max(...xs) * scale,
    Math.max(...ys) * scale,
  ];
};

const coordinates = (fields: Pair[], code: number): number[] =>
  fields
    .filter(([its]) => its === code)
    .map(([, value]) => Number(value))
    .filter((value) => !Number.isNaN(value));

type Matrix = readonly [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const MIRROR_X: Matrix = [-1, 0, 0, 1, 0, 0];

const apply = (matrix: Matrix, [x, y]: Position): Position => [
  matrix[0] * x + matrix[2] * y + matrix[4],
  matrix[1] * x + matrix[3] * y + matrix[5],
];

const compose = (outer: Matrix, inner: Matrix): Matrix => [
  outer[0] * inner[0] + outer[2] * inner[1],
  outer[1] * inner[0] + outer[3] * inner[1],
  outer[0] * inner[2] + outer[2] * inner[3],
  outer[1] * inner[2] + outer[3] * inner[3],
  outer[0] * inner[4] + outer[2] * inner[5] + outer[4],
  outer[1] * inner[4] + outer[3] * inner[5] + outer[5],
];

const translation = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y];

const isMirrored = (entity: DxfEntity): boolean =>
  entity.extrusionZ !== undefined && entity.extrusionZ < 0;

const DEFAULT_LAYER = "0";

type Walk = {
  blocks: Map<string, DxfBlock>;
  matrix: Matrix;
  layer: string;
  expanding: Set<string>;
  scale: number;
  features: Feature[];
};

const collect = (entities: DxfEntity[], walk: Walk): void => {
  entities.forEach((entity, index) => {
    if (entity.paperSpace) return;

    if (entity.type === "INSERT") {
      collectInsert(entity, attributesAfter(entities, index), walk);
      return;
    }
    if (entity.type === "ATTRIB") return;

    const feature = featureOf(entity, walk);
    if (feature !== null) walk.features.push(feature);
  });
};

const collectInsert = (
  insert: DxfEntity,
  attributes: Record<string, string>,
  walk: Walk,
): void => {
  const block = walk.blocks.get(insert.block ?? "");
  if (block === undefined || walk.expanding.has(block.name)) return;

  const layer = layerOf(insert, walk);

  for (const offset of arrayOffsets(insert)) {
    const matrix = compose(walk.matrix, insertMatrix(insert, block, offset));

    if (isContainer(block.name)) {
      collect(block.entities, {
        ...walk,
        matrix,
        layer,
        expanding: new Set([...walk.expanding, block.name]),
      });
      continue;
    }

    walk.features.push(
      featureWith(
        {
          type: "Point",
          coordinates: scaled(
            apply(matrix, [block.x ?? 0, block.y ?? 0]),
            walk.scale,
          ),
        },
        {
          ...attributes,
          Layer: layer,
          BlockName: decodeEscapes(block.name),
        },
      ),
    );
  }
};

const ANONYMOUS_BLOCK = /^(\*|A\$C)/;

const isContainer = (name: string): boolean => ANONYMOUS_BLOCK.test(name);

const insertMatrix = (
  insert: DxfEntity,
  block: DxfBlock,
  [offsetX, offsetY]: Position,
): Matrix => {
  const angle = ((insert.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const scaleX = insert.scaleX ?? 1;
  const scaleY = insert.scaleY ?? 1;
  const rotateAndScale: Matrix = [
    cos * scaleX,
    sin * scaleX,
    -sin * scaleY,
    cos * scaleY,
    0,
    0,
  ];

  const placed = compose(
    translation((insert.x ?? 0) + offsetX, (insert.y ?? 0) + offsetY),
    compose(rotateAndScale, translation(-(block.x ?? 0), -(block.y ?? 0))),
  );

  return isMirrored(insert) ? compose(MIRROR_X, placed) : placed;
};

const arrayOffsets = (insert: DxfEntity): Position[] => {
  const rows = insert.rowCount ?? 1;
  const columns = insert.columnCount ?? 1;
  if (rows <= 1 && columns <= 1) return [[0, 0]];

  const angle = ((insert.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rowSpacing = insert.rowSpacing ?? 0;
  const columnSpacing = insert.columnSpacing ?? 0;

  const offsets: Position[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      offsets.push([
        -sin * rowSpacing * row + cos * columnSpacing * column,
        cos * rowSpacing * row + sin * columnSpacing * column,
      ]);
    }
  }
  return offsets;
};

const attributesAfter = (
  entities: DxfEntity[],
  index: number,
): Record<string, string> => {
  const attributes: Record<string, string> = {};

  for (let next = index + 1; next < entities.length; next++) {
    const attrib = entities[next];
    if (attrib.type !== "ATTRIB") break;
    if (attrib.tag === undefined) continue;

    attributes[decodeEscapes(attrib.tag)] = decodeEscapes(
      attrib.text?.string ?? "",
    );
  }

  return attributes;
};

const layerOf = (entity: DxfEntity, walk: Walk): string => {
  const own = entity.layer ?? DEFAULT_LAYER;
  return own === DEFAULT_LAYER ? walk.layer : decodeEscapes(own);
};

const drawnTypes = new Set([
  "POINT",
  "LINE",
  "LWPOLYLINE",
  "POLYLINE",
  "CIRCLE",
  "ARC",
  "ELLIPSE",
  "SPLINE",
]);

const featureOf = (entity: DxfEntity, walk: Walk): Feature | null => {
  if (!drawnTypes.has(entity.type)) return null;

  const matrix = isMirrored(entity)
    ? compose(walk.matrix, MIRROR_X)
    : walk.matrix;
  const properties = { Layer: layerOf(entity, walk) };

  if (entity.type === "POINT") {
    return featureWith(
      {
        type: "Point",
        coordinates: scaled(
          apply(matrix, [entity.x ?? 0, entity.y ?? 0]),
          walk.scale,
        ),
      },
      properties,
    );
  }

  const polyline = polylineOf(entity);
  if (polyline.length < 2) return null;

  return featureWith(
    geometryOf(entity, placed(polyline, matrix, walk.scale)),
    properties,
  );
};

const placed = (
  positions: Position[],
  matrix: Matrix,
  scale: number,
): Position[] =>
  positions.map((position) => scaled(apply(matrix, position), scale));

const polylineOf = (entity: DxfEntity): [number, number][] => {
  if (entity.type !== "LWPOLYLINE" && entity.type !== "POLYLINE") {
    return entityToPolyline(entity);
  }
  if (entity.polygonMesh || entity.polyfaceMesh) return [];

  return entityToPolyline({
    ...entity,
    vertices: [...(entity.vertices ?? [])],
  });
};

const FULL_TURN = Math.PI * 2;
const FULL_TURN_TOLERANCE = 1e-9;

const isClosed = (entity: DxfEntity): boolean => {
  if (entity.type === "CIRCLE") return true;
  if (entity.type === "ELLIPSE") {
    return (
      Math.abs((entity.endAngle ?? 0) - (entity.startAngle ?? 0)) >=
      FULL_TURN - FULL_TURN_TOLERANCE
    );
  }

  return entity.closed === true;
};

const geometryOf = (entity: DxfEntity, positions: Position[]): Geometry => {
  if (!isClosed(entity)) return { type: "LineString", coordinates: positions };

  const ring = asRing(positions);
  return ring === null
    ? { type: "LineString", coordinates: positions }
    : { type: "Polygon", coordinates: [ring] };
};

const MINIMUM_RING_POSITIONS = 3;

const asRing = (positions: Position[]): Position[] | null => {
  const closed = samePosition(positions[0], positions[positions.length - 1])
    ? positions
    : [...positions, positions[0]];

  return distinctCount(closed) < MINIMUM_RING_POSITIONS ? null : closed;
};

const distinctCount = (positions: Position[]): number =>
  new Set(positions.map(([x, y]) => `${x},${y}`)).size;

const samePosition = (one: Position, other: Position): boolean =>
  one[0] === other[0] && one[1] === other[1];

const scaled = ([x, y]: Position, scale: number): Position =>
  scale === 1 ? [x, y] : [x * scale, y * scale];

const featureWith = (
  geometry: Geometry,
  properties: Record<string, string>,
): Feature => ({ type: "Feature", geometry, properties });
