import { Position } from "geojson";
import { COORDINATES_SIZE, FLOAT64_SIZE, UINT32_SIZE } from "./constants";
import { BinaryData, BufferType } from "./types";

export function createBuffer(size: number, bufferType: BufferType): BinaryData {
  return bufferType === "shared"
    ? new SharedArrayBuffer(size)
    : new ArrayBuffer(size);
}

export function encodeCount(view: DataView, count: number): void {
  view.setUint32(0, count, true);
}

export function decodeCount(view: DataView): number {
  return view.getUint32(0, true);
}

export function encodeCoordinates(
  coordinates: Position[],
  offset: number,
  view: DataView,
): void {
  coordinates.forEach((coord, i) => {
    const coordOffset = offset + i * COORDINATES_SIZE;
    view.setFloat64(coordOffset, coord[0], true);
    view.setFloat64(coordOffset + FLOAT64_SIZE, coord[1], true);
  });
}

export function decodeCoordinates(offset: number, view: DataView): Position {
  return [
    view.getFloat64(offset, true),
    view.getFloat64(offset + FLOAT64_SIZE, true),
  ];
}

export function encodeNodeId(offset: number, view: DataView, id: number): void {
  view.setUint32(offset, id, true);
}

export function decodeNodeId(offset: number, view: DataView): number {
  return view.getUint32(offset, true);
}

export function encodeLink(
  offset: number,
  view: DataView,
  id: number,
  start: number,
  end: number,
): void {
  view.setUint32(offset, id, true);
  offset += UINT32_SIZE;
  view.setUint32(offset, start, true);
  offset += UINT32_SIZE;
  view.setUint32(offset, end, true);
}

export function decodeLink(
  offset: number,
  view: DataView,
): { id: number; startNode: number; endNode: number } {
  const id = view.getUint32(offset, true);
  offset += UINT32_SIZE;
  const startNode = view.getUint32(offset, true);
  offset += UINT32_SIZE;
  const endNode = view.getUint32(offset, true);
  return { id, startNode, endNode };
}
