declare module "dxf" {
  export interface DxfVertex {
    x: number;
    y: number;
    bulge?: number;
  }

  export interface DxfEntity {
    type: string;
    layer?: string;
    paperSpace?: number;
    extrusionZ?: number;
    x?: number;
    y?: number;
    r?: number;
    start?: { x: number; y: number };
    end?: { x: number; y: number };
    vertices?: DxfVertex[];
    closed?: boolean;
    polygonMesh?: boolean;
    polyfaceMesh?: boolean;
    startAngle?: number;
    endAngle?: number;
    block?: string;
    scaleX?: number;
    scaleY?: number;
    rotation?: number;
    columnCount?: number;
    rowCount?: number;
    columnSpacing?: number;
    rowSpacing?: number;
    tag?: string;
    text?: { string?: string };
  }

  export interface DxfBlock {
    name: string;
    x?: number;
    y?: number;
    entities: DxfEntity[];
  }

  export interface DxfDocument {
    header: { insUnits?: number };
    blocks: DxfBlock[];
    entities: DxfEntity[];
  }

  export function parseString(content: string): DxfDocument;
}

declare module "dxf/lib/entityToPolyline" {
  import type { DxfEntity } from "dxf";

  function entityToPolyline(entity: DxfEntity): [number, number][];

  export default entityToPolyline;
}
