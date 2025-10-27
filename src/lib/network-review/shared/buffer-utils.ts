import { Position } from "geojson";
import { DataSize } from "./constants";
import { BinaryData, BufferType } from "./types";

export function createBuffer(size: number, bufferType: BufferType): BinaryData {
  return bufferType === "shared"
    ? new SharedArrayBuffer(size)
    : new ArrayBuffer(size);
}

export function decodeNumber(offset: number, view: DataView): number {
  return view.getUint32(offset, true);
}

export function encodeNumber(
  value: number,
  offset: number,
  view: DataView,
): void {
  view.setUint32(offset, value, true);
}

export const encodeCount = (view: DataView, count: number) =>
  encodeNumber(count, 0, view);

export const decodeCount = (view: DataView): number => decodeNumber(0, view);

export function encodePosition(
  position: Position,
  offset: number,
  view: DataView,
): void {
  view.setFloat64(offset, position[0], true);
  view.setFloat64(offset + DataSize.coordinate, position[1], true);
}

export function decodePosition(offset: number, view: DataView): Position {
  return [
    view.getFloat64(offset, true),
    view.getFloat64(offset + DataSize.coordinate, true),
  ];
}

export function encodeLineCoordinates(
  positions: Position[],
  offset: number,
  view: DataView,
): void {
  positions.forEach((position, i) => {
    const positionOffset = offset + i * DataSize.position;
    encodePosition(position, positionOffset, view);
  });
}

export function decodeLineCoordinates(
  count: number,
  offset: number,
  view: DataView,
): Position[] {
  const positions: Position[] = [];
  for (let i = 0; i < count; i++) {
    const positionOffset = offset + i * DataSize.position;
    positions.push(decodePosition(positionOffset, view));
  }
  return positions;
}

export const encodeId = (id: number, offset: number, view: DataView) =>
  encodeNumber(id, offset, view);

export const decodeId = (offset: number, view: DataView) =>
  decodeNumber(offset, view);

export function encodeType(type: number, offset: number, view: DataView): void {
  view.setUint8(offset, type);
}

export function decodeType(offset: number, view: DataView): number {
  return view.getUint8(offset);
}

export function encodeBounds(
  bounds: [number, number, number, number],
  offset: number,
  view: DataView,
): void {
  view.setFloat64(offset, bounds[0], true);
  view.setFloat64(offset + DataSize.coordinate, bounds[1], true);
  view.setFloat64(offset + DataSize.coordinate * 2, bounds[2], true);
  view.setFloat64(offset + DataSize.coordinate * 3, bounds[3], true);
}

export function decodeBounds(
  offset: number,
  view: DataView,
): [number, number, number, number] {
  return [
    view.getFloat64(offset, true),
    view.getFloat64(offset + DataSize.coordinate, true),
    view.getFloat64(offset + DataSize.coordinate * 2, true),
    view.getFloat64(offset + DataSize.coordinate * 3, true),
  ];
}

export function encodeNodeConnections(
  connectedLinkIds: number[],
  offset: number,
  view: DataView,
): number {
  encodeCount(view, connectedLinkIds.length);
  connectedLinkIds.forEach((linkId, idx) => {
    encodeId(linkId, offset + DataSize.count + idx * DataSize.id, view);
  });

  return offset;
}

export function decodeNodeConnections(
  offset: number,
  view: DataView,
): number[] {
  const linkIds: number[] = [];
  const offsetStart = offset;
  const count = decodeNumber(offsetStart, view);

  for (let i = 0; i < count; i++) {
    const linkId = decodeId(
      offsetStart + DataSize.count + i * DataSize.id,
      view,
    );
    linkIds.push(linkId);
  }

  return linkIds;
}

export function encodeLink(
  offset: number,
  view: DataView,
  id: number,
  start: number,
  end: number,
): void {
  view.setUint32(offset, id, true);
  offset += DataSize.id;
  view.setUint32(offset, start, true);
  offset += DataSize.id;
  view.setUint32(offset, end, true);
}

export function decodeLink(
  offset: number,
  view: DataView,
): { id: number; startNode: number; endNode: number } {
  const id = view.getUint32(offset, true);
  offset += DataSize.id;
  const startNode = view.getUint32(offset, true);
  offset += DataSize.id;
  const endNode = view.getUint32(offset, true);
  return { id, startNode, endNode };
}

export const encodeNodeId = (offset: number, view: DataView, id: number) =>
  encodeId(id, offset, view);
export const decodeNodeId = decodeId;
